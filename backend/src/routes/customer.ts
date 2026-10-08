import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  COUNTRY_BY_CODE,
  customerFeeMinor,
  FEE_SCHEDULE,
  PURPOSE_CODES,
  type FeeBearingType,
  type FeeQuote,
  type NameEnquiryResponse,
} from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, run } from "../db/query";
import type { TransactionRow, UserRow } from "../db/rows";
import { asyncHandler, rateLimit } from "../http/middleware";
import { deviceIdOf, bearerToken, requireUser } from "../http/auth";
import { badRequest, conflict, notFound, providerUnavailable } from "../lib/errors";
import { amountMinor, e164Phone, idempotencyKey, note, parse, pin } from "../lib/validation";
import { createCustomerAccount } from "../services/accounts";
import { audit } from "../services/audit";
import { logout, requestOtp, verifyOtp } from "../services/auth";
import { openDispute, listUserDisputes } from "../services/disputes";
import { createFxQuote } from "../services/fx";
import { upgradeTier1, upgradeTier2 } from "../services/kyc";
import { currencyOf, limitsUsage } from "../services/limits";
import { listNotifications, markNotificationsRead } from "../services/notifications";
import {
  bankFor,
  draftAirtime,
  draftBankTransfer,
  draftBill,
  draftCashIn,
  draftCashOut,
  draftCrossBorder,
  draftMerchant,
  draftMobileMoney,
  draftP2P,
  draftSavings,
  getTransaction,
  normalizeBankAccount,
  type PaymentDraft,
} from "../services/payments";
import { addMember, createGroup, draftContribution, getGroup, listGroups, requestPayout, votePayout } from "../services/groups";
import { applyRepayment, draftLoanDisbursement, draftLoanRepayment, listLoans, loanOffer, recordLoan } from "../services/loans";
import { changePin, setPin, verifyPin } from "../services/pin";
import { runPayment, type PaymentRequest } from "../services/pipeline";
import { createVault, listVaults } from "../services/savings";
import { statementCsv } from "../services/statements";
import { assertActive, getUser, toUserProfile, walletView } from "../services/users";
import { toUserTransaction } from "../services/views";

/** HTTP adapter over the channel-agnostic payment pipeline. */
async function executePayment(
  ctx: AppContext,
  req: Request,
  res: Response,
  operation: string,
  body: { idempotencyKey: string; pin?: string } & Record<string, unknown>,
  options: { requirePin: boolean; afterPosted?: PaymentRequest["afterPosted"] },
  build: (user: UserRow, deviceId: string | null) => PaymentDraft,
) {
  const result = await runPayment(ctx, {
    user: req.user!,
    deviceId: req.session?.device_id ?? null,
    operation,
    body: { ...body, path: req.path },
    requirePin: options.requirePin,
    build,
    afterPosted: options.afterPosted,
  });
  res.status(result.status).json(result.body);
}

function normalizeName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

async function resolveBankAccount(ctx: AppContext, user: UserRow, bankId: string, accountNumber: string): Promise<NameEnquiryResponse> {
  const bank = bankFor(user, bankId);
  const normalized = normalizeBankAccount(bank, accountNumber);
  const adapter = ctx.providers.get(bank.id);
  if (!adapter?.nameEnquiry) throw providerUnavailable("This bank isn't available right now. Please try again later.");
  let name: string | null;
  try {
    name = await adapter.nameEnquiry(normalized);
  } catch {
    throw providerUnavailable(`${bank.name} isn't responding right now. Please try again later.`);
  }
  if (!name) throw notFound(`${bank.name} couldn't find that account number. Check it and try again.`);
  return { bankId: bank.id, accountNumber: normalized, accountName: name };
}

function requireOwnWallet(req: Request): string {
  const walletId = req.params.walletId;
  if (!req.user!.wallet_account_id || req.user!.wallet_account_id !== walletId) throw notFound("Wallet not found");
  return walletId;
}

function userTransactions(ctx: AppContext, userId: string, limit: number): TransactionRow[] {
  return all<TransactionRow>(
    ctx.db,
    `SELECT * FROM transactions
     WHERE initiator_user_id = ?
        OR (counterparty_user_id = ? AND status IN ('COMPLETED', 'REVERSED'))
     ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    userId,
    userId,
    limit,
  );
}

export function customerRoutes(ctx: AppContext): Router {
  const root = Router();
  const authed = requireUser(ctx);
  const moneyLimiter = rateLimit(ctx, "money", 30, 60_000);

  // --- Auth -----------------------------------------------------------------
  const authRouter = Router();
  authRouter.post("/otp/send", rateLimit(ctx, "otp-send", 5, 60_000), (req, res) => {
    const body = parse(z.object({ phoneNumber: e164Phone, countryCode: z.string().length(2) }), req.body);
    res.json(requestOtp(ctx, body.phoneNumber, body.countryCode));
  });
  authRouter.post("/otp/verify", rateLimit(ctx, "otp-verify", 10, 60_000), (req, res) => {
    const body = parse(z.object({ phoneNumber: e164Phone, otp: z.string().regex(/^\d{6}$/, "must be 6 digits") }), req.body);
    res.json(verifyOtp(ctx, body.phoneNumber, body.otp, deviceIdOf(req, true)!));
  });
  authRouter.post("/logout", authed, (req, res) => {
    logout(ctx, bearerToken(req)!);
    res.status(204).end();
  });
  root.use("/auth", authRouter);

  // --- Profile, limits, notifications, PIN ------------------------------------
  root.get("/me", authed, (req, res) => {
    const user = req.user!;
    res.json({ user: toUserProfile(user), wallet: user.wallet_account_id ? walletView(ctx, user.wallet_account_id) : null });
  });
  root.get("/limits", authed, (req, res) => {
    res.json(limitsUsage(ctx, req.user!));
  });
  root.get("/notifications", authed, (req, res) => {
    res.json({ notifications: listNotifications(ctx, req.user!.id) });
  });
  root.post("/notifications/read", authed, (req, res) => {
    markNotificationsRead(ctx, req.user!.id);
    res.status(204).end();
  });
  root.post("/me/pin", authed, (req, res) => {
    const body = parse(z.object({ pin }), req.body);
    setPin(ctx, req.user!, body.pin);
    res.status(201).json({ user: toUserProfile(getUser(ctx, req.user!.id)!) });
  });
  root.post("/me/pin/change", authed, rateLimit(ctx, "pin-change", 5, 60_000), (req, res) => {
    const body = parse(z.object({ currentPin: pin, newPin: pin }), req.body);
    changePin(ctx, req.user!, body.currentPin, body.newPin);
    res.status(204).end();
  });

  // --- KYC ------------------------------------------------------------------
  root.get("/kyc/status", authed, (req, res) => {
    res.json({ kycTier: req.user!.kyc_tier, kycReviewPending: !!req.user!.kyc_review_pending });
  });
  root.post("/kyc/tier1", authed, rateLimit(ctx, "kyc", 10, 60_000), (req, res) => {
    const body = parse(
      z.object({ fullName: z.string().max(100), dateOfBirth: z.string(), nationalId: z.string().max(40) }),
      req.body,
    );
    res.json(upgradeTier1(ctx, req.user!, body));
  });
  root.post("/kyc/tier2", authed, (req, res) => {
    const body = parse(z.object({ proofOfAddressConfirmed: z.boolean(), livenessCheckPassed: z.boolean() }), req.body);
    res.json(upgradeTier2(ctx, req.user!, body));
  });

  // --- Wallets ----------------------------------------------------------------
  root.post("/wallets", authed, (req, res) => {
    const user = getUser(ctx, req.user!.id)!;
    if (user.wallet_account_id) {
      res.json({ wallet: walletView(ctx, user.wallet_account_id) });
      return;
    }
    assertActive(user);
    const wallet = withTx(ctx.db, () => {
      const account = createCustomerAccount(ctx, "WALLET", currencyOf(user), user.id, `Wallet ${user.phone}`);
      run(ctx.db, "UPDATE users SET wallet_account_id = ? WHERE id = ?", account.id, user.id);
      audit(ctx, { actorType: "USER", actorId: user.id, action: "WALLET_CREATED", entityType: "account", entityId: account.id });
      return walletView(ctx, account.id);
    });
    res.status(201).json({ wallet });
  });
  const walletRead = (req: Request, res: Response) => {
    res.json({ wallet: walletView(ctx, requireOwnWallet(req)) });
  };
  root.get("/wallets/:walletId", authed, walletRead);
  root.get("/wallets/:walletId/balances", authed, walletRead);
  root.get("/wallets/:walletId/transactions", authed, (req, res) => {
    requireOwnWallet(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    res.json({ transactions: userTransactions(ctx, req.user!.id, limit).map((t) => toUserTransaction(ctx, t, req.user!.id)) });
  });
  root.get("/wallets/:walletId/statement.csv", authed, rateLimit(ctx, "statement", 10, 60_000), (req, res) => {
    const walletId = requireOwnWallet(req);
    const to = typeof req.query.to === "string" && !Number.isNaN(Date.parse(req.query.to)) ? new Date(req.query.to) : ctx.now();
    const from =
      typeof req.query.from === "string" && !Number.isNaN(Date.parse(req.query.from))
        ? new Date(req.query.from)
        : new Date(to.getTime() - 30 * 86_400_000);
    if (from >= to) throw badRequest("from must be before to");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="benki-statement-${from.toISOString().slice(0, 10)}.csv"`);
    res.send(statementCsv(ctx, walletId, currencyOf(req.user!), from.toISOString(), to.toISOString()));
  });

  const cashSchema = z.object({ idempotencyKey, agentId: z.string(), amountMinor });
  root.post(
    "/wallets/:walletId/cash-in",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      requireOwnWallet(req);
      const body = parse(cashSchema, req.body);
      await executePayment(ctx, req, res, "cash-in", body, { requirePin: false }, (u, d) => draftCashIn(u, body, d));
    }),
  );
  root.post(
    "/wallets/:walletId/cash-out",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      requireOwnWallet(req);
      const body = parse(cashSchema.extend({ pin }), req.body);
      await executePayment(ctx, req, res, "cash-out", body, { requirePin: true }, (u, d) => draftCashOut(u, body, d));
    }),
  );
  root.post(
    "/wallets/:walletId/airtime-topup",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      requireOwnWallet(req);
      const body = parse(z.object({ idempotencyKey, pin, providerId: z.string(), amountMinor, phoneNumber: e164Phone.optional() }), req.body);
      await executePayment(ctx, req, res, "airtime", body, { requirePin: true }, (u, d) => draftAirtime(ctx, u, body, d));
    }),
  );

  // --- Transfers ----------------------------------------------------------------
  root.post(
    "/transfers/internal",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(z.object({ idempotencyKey, pin, destinationPhoneNumber: e164Phone, amountMinor, note }), req.body);
      await executePayment(ctx, req, res, "p2p", body, { requirePin: true }, (u, d) => draftP2P(ctx, u, body, d));
    }),
  );
  root.post(
    "/transfers/mobile-money",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(
        z.object({ idempotencyKey, pin, providerId: z.string(), destinationPhoneNumber: e164Phone, amountMinor, note }),
        req.body,
      );
      await executePayment(ctx, req, res, "mobile-money", body, { requirePin: true }, (u, d) => draftMobileMoney(ctx, u, body, d));
    }),
  );
  root.post("/transfers/cross-border/quote", authed, rateLimit(ctx, "fx-quote", 30, 60_000), (req, res) => {
    const body = parse(z.object({ destinationCountryCode: z.string().length(2), sendAmountMinor: amountMinor }), req.body);
    res.status(201).json(createFxQuote(ctx, req.user!, body.destinationCountryCode, body.sendAmountMinor));
  });
  const purposeIds = PURPOSE_CODES.map((p) => p.id) as [string, ...string[]];
  root.post(
    "/transfers/cross-border",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(
        z.object({ idempotencyKey, pin, quoteId: z.string(), destinationPhoneNumber: e164Phone, purposeCode: z.enum(purposeIds) }),
        req.body,
      );
      await executePayment(ctx, req, res, "cross-border", body, { requirePin: true }, (u, d) => draftCrossBorder(ctx, u, body, d));
    }),
  );
  root.post("/transfers/bank/name-enquiry", authed, rateLimit(ctx, "name-enquiry", 20, 60_000), asyncHandler(async (req, res) => {
    const body = parse(z.object({ bankId: z.string(), accountNumber: z.string().max(34) }), req.body);
    res.json(await resolveBankAccount(ctx, req.user!, body.bankId, body.accountNumber));
  }));
  root.post(
    "/transfers/bank",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(
        z.object({ idempotencyKey, pin, bankId: z.string(), accountNumber: z.string().max(34), accountName: z.string().max(100), amountMinor, note }),
        req.body,
      );
      // Re-run name enquiry at send time: the customer must have confirmed the
      // name the bank holds *now*, so a typo'd or recycled account is caught.
      const resolved = await resolveBankAccount(ctx, req.user!, body.bankId, body.accountNumber);
      if (normalizeName(resolved.accountName) !== normalizeName(body.accountName)) {
        throw conflict("The account name has changed since you checked it. Look it up again and confirm.");
      }
      await executePayment(ctx, req, res, "bank-transfer", body, { requirePin: true }, (u, d) =>
        draftBankTransfer(ctx, u, { ...body, resolvedName: resolved.accountName }, d),
      );
    }),
  );
  root.get("/transfers/:transactionId", authed, (req, res) => {
    const tx = getTransaction(ctx, req.params.transactionId);
    const userId = req.user!.id;
    if (!tx || (tx.initiator_user_id !== userId && tx.counterparty_user_id !== userId)) throw notFound("Transaction not found");
    if (tx.initiator_user_id !== userId && !["COMPLETED", "REVERSED"].includes(tx.status)) throw notFound("Transaction not found");
    res.json({ transaction: toUserTransaction(ctx, tx, userId) });
  });

  // --- Payments -----------------------------------------------------------------
  root.post(
    "/payments/bills",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(z.object({ idempotencyKey, pin, billerId: z.string(), accountNumber: z.string().max(20), amountMinor }), req.body);
      await executePayment(ctx, req, res, "bill", body, { requirePin: true }, (u, d) => draftBill(ctx, u, body, d));
    }),
  );
  root.post(
    "/payments/merchant",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(z.object({ idempotencyKey, pin, merchantCode: z.string().max(20), amountMinor, note }), req.body);
      await executePayment(ctx, req, res, "merchant", body, { requirePin: true }, (u, d) => draftMerchant(ctx, u, body, d));
    }),
  );

  // --- Savings ------------------------------------------------------------------
  root.get("/savings", authed, (req, res) => {
    res.json({ vaults: listVaults(ctx, req.user!.id) });
  });
  root.post("/savings", authed, (req, res) => {
    const body = parse(z.object({ name: z.string(), targetMinor: amountMinor }), req.body);
    res.status(201).json({ vault: createVault(ctx, getUser(ctx, req.user!.id)!, body.name, body.targetMinor) });
  });
  for (const direction of ["deposit", "withdraw"] as const) {
    root.post(
      `/savings/:vaultId/${direction}`,
      authed,
      moneyLimiter,
      asyncHandler(async (req, res) => {
        const body = parse(z.object({ idempotencyKey, amountMinor }), req.body);
        await executePayment(ctx, req, res, `savings-${direction}`, { ...body, vaultId: req.params.vaultId }, { requirePin: false }, (u) =>
          draftSavings(ctx, u, req.params.vaultId, direction === "deposit" ? "DEPOSIT" : "WITHDRAWAL", body.amountMinor),
        );
      }),
    );
  }

  // --- Nano-loans -------------------------------------------------------------------
  root.get("/loans/offer", authed, (req, res) => {
    res.json(loanOffer(ctx, req.user!));
  });
  root.get("/loans", authed, (req, res) => {
    res.json({ loans: listLoans(ctx, req.user!.id) });
  });
  root.post(
    "/loans",
    authed,
    rateLimit(ctx, "loans", 5, 60_000),
    asyncHandler(async (req, res) => {
      const body = parse(
        z.object({
          idempotencyKey,
          pin,
          principalMinor: amountMinor,
          acceptTerms: z.literal(true, { errorMap: () => ({ message: "you must accept the loan terms" }) }),
        }),
        req.body,
      );
      await executePayment(
        ctx,
        req,
        res,
        "loan",
        body,
        { requirePin: true, afterPosted: (tx) => ({ loan: recordLoan(ctx, tx) }) },
        (u) => draftLoanDisbursement(ctx, u, body.principalMinor),
      );
    }),
  );
  root.post(
    "/loans/:loanId/repay",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(z.object({ idempotencyKey, pin, amountMinor }), req.body);
      await executePayment(
        ctx,
        req,
        res,
        "loan-repay",
        { ...body, loanId: req.params.loanId },
        { requirePin: true, afterPosted: (tx) => ({ loan: applyRepayment(ctx, tx) }) },
        (u) => draftLoanRepayment(ctx, u, req.params.loanId, body.amountMinor),
      );
    }),
  );

  // --- Savings groups (chama / tontine / susu) ------------------------------------------
  root.get("/groups", authed, (req, res) => {
    res.json({ groups: listGroups(ctx, req.user!.id) });
  });
  root.post("/groups", authed, rateLimit(ctx, "groups", 10, 60_000), (req, res) => {
    const body = parse(z.object({ name: z.string() }), req.body);
    res.status(201).json({ group: createGroup(ctx, getUser(ctx, req.user!.id)!, body.name) });
  });
  root.get("/groups/:groupId", authed, (req, res) => {
    res.json({ group: getGroup(ctx, req.user!.id, req.params.groupId) });
  });
  root.post("/groups/:groupId/members", authed, rateLimit(ctx, "groups", 10, 60_000), (req, res) => {
    const body = parse(z.object({ phoneNumber: e164Phone }), req.body);
    res.status(201).json({ group: addMember(ctx, req.user!, req.params.groupId, body.phoneNumber) });
  });
  root.post(
    "/groups/:groupId/contribute",
    authed,
    moneyLimiter,
    asyncHandler(async (req, res) => {
      const body = parse(z.object({ idempotencyKey, pin, amountMinor }), req.body);
      await executePayment(ctx, req, res, "group-contribution", { ...body, groupId: req.params.groupId }, { requirePin: true }, (u, d) =>
        draftContribution(ctx, u, req.params.groupId, body.amountMinor, d),
      );
    }),
  );
  root.post("/groups/:groupId/payouts", authed, rateLimit(ctx, "groups", 10, 60_000), (req, res) => {
    const body = parse(z.object({ pin, recipientUserId: z.string(), amountMinor, reason: z.string() }), req.body);
    verifyPin(ctx, req.user!, body.pin);
    res.status(201).json({ group: requestPayout(ctx, req.user!, req.params.groupId, body) });
  });
  root.post("/groups/:groupId/payouts/:requestId/vote", authed, rateLimit(ctx, "groups", 10, 60_000), (req, res) => {
    const body = parse(z.object({ pin, approve: z.boolean() }), req.body);
    verifyPin(ctx, req.user!, body.pin);
    res.json({ group: votePayout(ctx, req.user!, req.params.groupId, req.params.requestId, body.approve) });
  });

  // --- Disputes -------------------------------------------------------------------
  root.get("/disputes", authed, (req, res) => {
    res.json({ disputes: listUserDisputes(ctx, req.user!.id) });
  });
  root.post("/disputes", authed, rateLimit(ctx, "disputes", 10, 60_000), (req, res) => {
    const body = parse(z.object({ transactionId: z.string(), reason: z.string().max(500) }), req.body);
    res.status(201).json({ dispute: openDispute(ctx, req.user!, body.transactionId, body.reason) });
  });

  // --- Pricing transparency ---------------------------------------------------------
  root.get("/pricing/quote", authed, (req, res) => {
    const type = String(req.query.type ?? "") as FeeBearingType;
    if (!(type in FEE_SCHEDULE)) throw badRequest("Unknown transaction type");
    const amount = parse(amountMinor, Number(req.query.amountMinor));
    const currency = COUNTRY_BY_CODE[req.user!.country_code].currency;
    const feeMinor = customerFeeMinor(type, amount);
    const quote: FeeQuote = {
      type,
      currency,
      amountMinor: amount,
      feeMinor,
      totalDebitMinor: amount + feeMinor,
      description: FEE_SCHEDULE[type].description,
    };
    res.json(quote);
  });

  return root;
}
