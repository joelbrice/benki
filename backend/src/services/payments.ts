import {
  COUNTRY_BY_CODE,
  customerFeeMinor,
  banksFor,
  findMerchant,
  formatAmount,
  merchantFeeMinor,
  MIN_TIER_FOR_SERVICE,
  tierAtLeast,
  type Bank,
  type KycTier,
  type PaymentResponse,
  type RuleHit,
  type TransactionType,
} from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { one, run } from "../db/query";
import type { StaffRow, TransactionRow, UserRow, VaultRow } from "../db/rows";
import { randomDigits } from "../lib/crypto";
import { ApiError, badRequest, complianceBlock, conflict, forbidden, insufficientFunds, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { agentFloatAccountId, systemAccount } from "./accounts";
import { audit } from "./audit";
import { closeAlertsForTransaction, raiseAlert } from "./compliance";
import { availableOf, entriesForTransaction, placeHold, postEntry, resolveHolds, reverseEntry, type PostingInput } from "./ledger";
import { currencyOf, enforceHoldingsCap, enforceOutflowLimits } from "./limits";
import { notify } from "./notifications";
import { EXTERNAL_RAIL_TYPES } from "./providers";
import { assessRisk } from "./risk";
import { assertActive, getUser, getUserByPhone, maskPhone, touchActivity, walletView } from "./users";
import { toUserTransaction } from "./views";

export interface PaymentDraft {
  type: TransactionType;
  userId: string;
  amountMinor: number;
  feeMinor: number;
  merchantFeeMinor: number;
  currency: string;
  sourceAccountId: string;
  destinationAccountId: string;
  counterpartyUserId: string | null;
  counterpartyLabel: string;
  counterpartyKey: string | null;
  note: string;
  providerId: string | null;
  purposeCode: string | null;
  receiveAmountMinor: number | null;
  receiveCurrency: string | null;
  metadata: Record<string, unknown>;
  minTier: KycTier;
  /** Counts against the customer's outgoing limits. */
  outflow: boolean;
  /** Check (and on review, reserve) amount + fee in the source account up front. */
  checkFunds: boolean;
  /** Run the AML/fraud risk engine. */
  screen: boolean;
  /** Apply the e-money balance cap to this user for `recipientCapAmountMinor`. */
  recipientCapUserId: string | null;
  recipientCapAmountMinor: number;
  deviceId: string | null;
}

export interface PaymentOutcome {
  tx: TransactionRow;
  status: number;
  message: string;
  blocked: boolean;
  needsDispatch: boolean;
}

const TYPE_LABEL: Record<TransactionType, string> = {
  CASH_IN: "Deposit",
  CASH_OUT: "Withdrawal",
  P2P: "Transfer",
  MOBILE_MONEY_PAYOUT: "Mobile money transfer",
  AIRTIME: "Airtime",
  BILL_PAYMENT: "Bill payment",
  MERCHANT_PAYMENT: "Merchant payment",
  CROSS_BORDER: "International transfer",
  SAVINGS_DEPOSIT: "Savings deposit",
  SAVINGS_WITHDRAWAL: "Savings withdrawal",
  BANK_TRANSFER: "Bank transfer",
  LOAN_DISBURSEMENT: "Loan disbursement",
  LOAN_REPAYMENT: "Loan repayment",
  GROUP_CONTRIBUTION: "Group contribution",
  GROUP_PAYOUT: "Group payout",
  REVERSAL: "Reversal",
  ADJUSTMENT: "Adjustment",
};

export function getTransaction(ctx: AppContext, id: string): TransactionRow | undefined {
  return one<TransactionRow>(ctx.db, "SELECT * FROM transactions WHERE id = ?", id);
}

export function requireWallet(user: UserRow): string {
  if (!user.wallet_account_id) throw badRequest("Create a wallet first");
  return user.wallet_account_id;
}

/** The single source of truth for how each transaction type moves money. */
export function postingsFor(ctx: AppContext, tx: TransactionRow): PostingInput[] {
  const src = tx.source_account_id!;
  const dst = tx.destination_account_id!;
  const amt = tx.amount_minor;
  const fee = tx.fee_minor;
  const feeAccount = () => systemAccount(ctx, "FEE_REVENUE", tx.currency);
  switch (tx.type) {
    case "CASH_IN":
    case "SAVINGS_DEPOSIT":
    case "SAVINGS_WITHDRAWAL":
    case "LOAN_DISBURSEMENT":
    case "GROUP_CONTRIBUTION":
    case "GROUP_PAYOUT":
      return [
        { accountId: src, amountMinor: -amt },
        { accountId: dst, amountMinor: amt },
      ];
    case "MERCHANT_PAYMENT":
      return [
        { accountId: src, amountMinor: -amt },
        { accountId: dst, amountMinor: amt - tx.merchant_fee_minor },
        { accountId: feeAccount(), amountMinor: tx.merchant_fee_minor },
      ];
    case "CROSS_BORDER": {
      const receive = tx.receive_amount_minor!;
      return [
        { accountId: src, amountMinor: -(amt + fee) },
        { accountId: feeAccount(), amountMinor: fee },
        { accountId: systemAccount(ctx, "FX_POSITION", tx.currency), amountMinor: amt },
        { accountId: systemAccount(ctx, "FX_POSITION", tx.receive_currency!), amountMinor: -receive },
        { accountId: dst, amountMinor: receive },
      ];
    }
    case "LOAN_REPAYMENT": {
      // Repayments clear the fee first, then principal back into the loan book.
      const { feePortionMinor } = JSON.parse(tx.metadata) as { feePortionMinor: number };
      return [
        { accountId: src, amountMinor: -amt },
        { accountId: feeAccount(), amountMinor: feePortionMinor },
        { accountId: dst, amountMinor: amt - feePortionMinor },
      ];
    }
    case "CASH_OUT":
    case "P2P":
    case "MOBILE_MONEY_PAYOUT":
    case "BANK_TRANSFER":
    case "AIRTIME":
    case "BILL_PAYMENT":
      return [
        { accountId: src, amountMinor: -(amt + fee) },
        { accountId: dst, amountMinor: amt },
        { accountId: feeAccount(), amountMinor: fee },
      ];
    default:
      throw new Error(`No posting rule for ${tx.type}`);
  }
}

function prepaidToken(): string {
  return randomDigits(20).replace(/(\d{4})(?=\d)/g, "$1-");
}

/** Posts the ledger entry for an approved transaction and moves it to its post-posting status. */
function settle(ctx: AppContext, tx: TransactionRow): TransactionRow {
  postEntry(ctx, { transactionId: tx.id, kind: "PAYMENT", description: `${TYPE_LABEL[tx.type]} ${tx.id}`, postings: postingsFor(ctx, tx) });
  const meta = JSON.parse(tx.metadata) as { issuesToken?: boolean };
  const token = tx.type === "BILL_PAYMENT" && meta.issuesToken ? prepaidToken() : null;
  const viaExternalRail = (EXTERNAL_RAIL_TYPES as readonly string[]).includes(tx.type);
  const now = ctx.nowIso();
  run(
    ctx.db,
    "UPDATE transactions SET status = ?, token = COALESCE(?, token), completed_at = ?, updated_at = ? WHERE id = ?",
    viaExternalRail ? "PENDING" : "COMPLETED",
    token,
    viaExternalRail ? null : now,
    now,
    tx.id,
  );
  return getTransaction(ctx, tx.id)!;
}

function completionMessage(tx: TransactionRow): string {
  const amount = formatAmount(tx.amount_minor, tx.currency);
  switch (tx.type) {
    case "MOBILE_MONEY_PAYOUT":
    case "BANK_TRANSFER":
      return `Sending ${amount} to ${tx.counterparty_label}. We'll confirm delivery shortly.`;
    case "BILL_PAYMENT":
      return tx.token ? `Bill paid. Your meter token is ${tx.token}.` : "Bill paid.";
    case "CASH_OUT":
      return `Withdrawal of ${amount} approved — collect your cash from the agent.`;
    case "CROSS_BORDER":
      return `Sent. The recipient gets ${formatAmount(tx.receive_amount_minor!, tx.receive_currency!)}.`;
    default:
      return `${TYPE_LABEL[tx.type]} of ${amount} completed.`;
  }
}

function notifyCompleted(ctx: AppContext, tx: TransactionRow) {
  const fee = tx.fee_minor ? ` (fee ${formatAmount(tx.fee_minor, tx.currency)})` : "";
  if (!(EXTERNAL_RAIL_TYPES as readonly string[]).includes(tx.type)) {
    notify(ctx, tx.initiator_user_id, "TRANSACTION", `${TYPE_LABEL[tx.type]}: ${formatAmount(tx.amount_minor, tx.currency)} — ${tx.counterparty_label}${fee}. Ref ${tx.id}.`);
  }
  if (tx.counterparty_user_id && (tx.type === "P2P" || tx.type === "CROSS_BORDER")) {
    const sender = getUser(ctx, tx.initiator_user_id)!;
    const received = formatAmount(tx.receive_amount_minor ?? tx.amount_minor, tx.receive_currency ?? tx.currency);
    notify(ctx, tx.counterparty_user_id, "TRANSACTION", `You received ${received} from ${sender.full_name ?? sender.phone}. Ref ${tx.id}.`);
  }
}

/**
 * Runs a payment through every control in order and records the outcome.
 * Must be called inside a transaction: any thrown error (limit, funds,
 * validation) rolls back everything, including the idempotency claim. A
 * compliance BLOCK is *not* thrown — the blocked attempt is committed for the
 * audit trail and the caller turns it into a 422.
 */
export function submitPayment(ctx: AppContext, draft: PaymentDraft): PaymentOutcome {
  const user = getUser(ctx, draft.userId)!;
  assertActive(user);
  if (!tierAtLeast(user.kyc_tier, draft.minTier)) {
    throw forbidden("Verify your identity (Tier 1) to use this service.");
  }
  if (draft.outflow) enforceOutflowLimits(ctx, user, draft.amountMinor);
  if (draft.checkFunds) {
    const needed = draft.amountMinor + draft.feeMinor;
    if (availableOf(ctx, draft.sourceAccountId) < needed) {
      throw insufficientFunds(
        draft.feeMinor
          ? `Insufficient funds — this needs ${formatAmount(needed, draft.currency)} including the ${formatAmount(draft.feeMinor, draft.currency)} fee.`
          : "Insufficient funds",
      );
    }
  }
  if (draft.recipientCapUserId) {
    const recipient = getUser(ctx, draft.recipientCapUserId)!;
    enforceHoldingsCap(ctx, recipient, draft.recipientCapAmountMinor, recipient.id === user.id);
  }

  const risk = draft.screen
    ? assessRisk(ctx, {
        user,
        type: draft.type,
        amountMinor: draft.amountMinor,
        deviceId: draft.deviceId,
        counterpartyUserId: draft.counterpartyUserId,
        counterpartyKey: draft.counterpartyKey,
      })
    : { decision: "ALLOW" as const, score: 0, hits: [] as RuleHit[] };

  const id = newId("TXN");
  const now = ctx.nowIso();
  const initialStatus = risk.decision === "BLOCK" ? "BLOCKED" : risk.decision === "REVIEW" ? "PENDING_REVIEW" : "PENDING";
  run(
    ctx.db,
    `INSERT INTO transactions (id, type, status, initiator_user_id, counterparty_user_id, source_account_id, destination_account_id,
       amount_minor, fee_minor, merchant_fee_minor, currency, receive_amount_minor, receive_currency, counterparty_label,
       counterparty_key, note, provider_id, purpose_code, risk_decision, risk_score, rule_hits, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    draft.type,
    initialStatus,
    user.id,
    draft.counterpartyUserId,
    draft.sourceAccountId,
    draft.destinationAccountId,
    draft.amountMinor,
    draft.feeMinor,
    draft.merchantFeeMinor,
    draft.currency,
    draft.receiveAmountMinor,
    draft.receiveCurrency,
    draft.counterpartyLabel,
    draft.counterpartyKey,
    draft.note,
    draft.providerId,
    draft.purposeCode,
    risk.decision,
    risk.score,
    JSON.stringify(risk.hits),
    JSON.stringify(draft.metadata),
    now,
    now,
  );
  const auditDetails = { type: draft.type, amountMinor: draft.amountMinor, currency: draft.currency, decision: risk.decision, rules: risk.hits.map((h) => h.code) };

  if (risk.decision === "BLOCK") {
    raiseAlert(ctx, { kind: "TRANSACTION", userId: user.id, transactionId: id, severity: "CRITICAL", hits: risk.hits });
    audit(ctx, { actorType: "USER", actorId: user.id, action: "TRANSACTION_BLOCKED", entityType: "transaction", entityId: id, details: auditDetails });
    return { tx: getTransaction(ctx, id)!, status: 422, message: complianceBlock().message, blocked: true, needsDispatch: false };
  }

  touchActivity(ctx, user.id);

  if (risk.decision === "REVIEW") {
    if (draft.checkFunds) placeHold(ctx, draft.sourceAccountId, id, draft.amountMinor + draft.feeMinor);
    raiseAlert(ctx, { kind: "TRANSACTION", userId: user.id, transactionId: id, severity: risk.score >= 70 ? "HIGH" : "MEDIUM", hits: risk.hits });
    notify(ctx, user.id, "TRANSACTION", `Your ${TYPE_LABEL[draft.type].toLowerCase()} of ${formatAmount(draft.amountMinor, draft.currency)} is being processed. Ref ${id}.`);
    audit(ctx, { actorType: "USER", actorId: user.id, action: "TRANSACTION_HELD", entityType: "transaction", entityId: id, details: auditDetails });
    const message = draft.checkFunds
      ? "Your payment is being processed and may take a little longer. The funds are reserved in your wallet."
      : "Your deposit is being processed and will show in your balance shortly.";
    return { tx: getTransaction(ctx, id)!, status: 202, message, blocked: false, needsDispatch: false };
  }

  const tx = settle(ctx, getTransaction(ctx, id)!);
  notifyCompleted(ctx, tx);
  audit(ctx, { actorType: "USER", actorId: user.id, action: "TRANSACTION_POSTED", entityType: "transaction", entityId: id, details: auditDetails });
  return { tx, status: 201, message: completionMessage(tx), blocked: false, needsDispatch: tx.status === "PENDING" };
}

export function paymentResponse(ctx: AppContext, tx: TransactionRow, userId: string, message: string): PaymentResponse {
  const user = getUser(ctx, userId)!;
  return { transaction: toUserTransaction(ctx, tx, userId), wallet: walletView(ctx, user.wallet_account_id!), message };
}

// --- Draft builders: validate the request and resolve accounts ---------------

function base(user: UserRow, type: TransactionType, amountMinor: number, deviceId: string | null): Omit<PaymentDraft, "sourceAccountId" | "destinationAccountId" | "counterpartyLabel"> {
  return {
    type,
    userId: user.id,
    amountMinor,
    feeMinor: 0,
    merchantFeeMinor: 0,
    currency: currencyOf(user),
    counterpartyUserId: null,
    counterpartyKey: null,
    note: "",
    providerId: null,
    purposeCode: null,
    receiveAmountMinor: null,
    receiveCurrency: null,
    metadata: {},
    minTier: "TIER_0",
    outflow: true,
    checkFunds: true,
    screen: true,
    recipientCapUserId: null,
    recipientCapAmountMinor: 0,
    deviceId,
  };
}

function country(user: UserRow) {
  return COUNTRY_BY_CODE[user.country_code];
}

function assertLocalPhone(user: UserRow, phone: string) {
  const c = country(user);
  if (!phone.startsWith(c.callingCode)) throw badRequest(`Use a ${c.name} number starting with ${c.callingCode}`);
}

export function draftCashIn(user: UserRow, input: { agentId: string; amountMinor: number }, deviceId: string | null): PaymentDraft {
  const agent = country(user).agents.find((a) => a.id === input.agentId);
  if (!agent) throw badRequest("Choose an agent in your country");
  return {
    ...base(user, "CASH_IN", input.amountMinor, deviceId),
    sourceAccountId: agentFloatAccountId(agent.id),
    destinationAccountId: requireWallet(user),
    counterpartyLabel: `${agent.name}, ${agent.location}`,
    counterpartyKey: `agent:${agent.id}`,
    outflow: false,
    checkFunds: false,
    recipientCapUserId: user.id,
    recipientCapAmountMinor: input.amountMinor,
  };
}

export function draftCashOut(user: UserRow, input: { agentId: string; amountMinor: number }, deviceId: string | null): PaymentDraft {
  const agent = country(user).agents.find((a) => a.id === input.agentId);
  if (!agent) throw badRequest("Choose an agent in your country");
  return {
    ...base(user, "CASH_OUT", input.amountMinor, deviceId),
    feeMinor: customerFeeMinor("CASH_OUT", input.amountMinor),
    sourceAccountId: requireWallet(user),
    destinationAccountId: agentFloatAccountId(agent.id),
    counterpartyLabel: `${agent.name}, ${agent.location}`,
    counterpartyKey: `agent:${agent.id}`,
  };
}

export function draftP2P(
  ctx: AppContext,
  user: UserRow,
  input: { destinationPhoneNumber: string; amountMinor: number; note?: string },
  deviceId: string | null,
): PaymentDraft {
  const recipient = getUserByPhone(ctx, input.destinationPhoneNumber);
  if (!recipient) throw notFound("No Benki account is registered to that number");
  if (recipient.id === user.id) throw badRequest("You can't send money to yourself");
  if (recipient.country_code !== user.country_code) throw badRequest("For other countries, use an international transfer");
  if (!recipient.wallet_account_id || recipient.status === "CLOSED") throw badRequest("That person can't receive money yet");
  return {
    ...base(user, "P2P", input.amountMinor, deviceId),
    feeMinor: customerFeeMinor("P2P", input.amountMinor),
    sourceAccountId: requireWallet(user),
    destinationAccountId: recipient.wallet_account_id,
    counterpartyUserId: recipient.id,
    counterpartyLabel: recipient.full_name ? `${recipient.full_name} (${maskPhone(recipient.phone)})` : recipient.phone,
    counterpartyKey: `user:${recipient.id}`,
    note: input.note ?? "",
    recipientCapUserId: recipient.id,
    recipientCapAmountMinor: input.amountMinor,
  };
}

export function draftMobileMoney(
  ctx: AppContext,
  user: UserRow,
  input: { providerId: string; destinationPhoneNumber: string; amountMinor: number; note?: string },
  deviceId: string | null,
): PaymentDraft {
  const provider = country(user).mobileMoneyProviders.find((p) => p.id === input.providerId);
  if (!provider || !ctx.providers.has(provider.id)) throw badRequest("Choose a mobile money provider in your country");
  assertLocalPhone(user, input.destinationPhoneNumber);
  const currency = currencyOf(user);
  return {
    ...base(user, "MOBILE_MONEY_PAYOUT", input.amountMinor, deviceId),
    feeMinor: customerFeeMinor("MOBILE_MONEY_PAYOUT", input.amountMinor),
    sourceAccountId: requireWallet(user),
    destinationAccountId: systemAccount(ctx, "MOMO_SETTLEMENT", currency, provider.id),
    counterpartyLabel: `${provider.label} · ${input.destinationPhoneNumber}`,
    counterpartyKey: `momo:${provider.id}:${input.destinationPhoneNumber}`,
    providerId: provider.id,
    note: input.note ?? "",
    metadata: { destination: input.destinationPhoneNumber },
    minTier: MIN_TIER_FOR_SERVICE.MOBILE_MONEY_PAYOUT,
  };
}

export function bankFor(user: UserRow, bankId: string) {
  const bank = banksFor(user.country_code).find((b) => b.id === bankId);
  if (!bank) throw badRequest("Choose a bank in your country");
  return bank;
}

export function normalizeBankAccount(bank: Bank, accountNumber: string): string {
  const normalized = accountNumber.replace(/[\s-]/g, "");
  if (!new RegExp(bank.accountNumberPattern).test(normalized)) throw badRequest(`Enter a valid ${bank.accountNumberHint.toLowerCase()}`);
  return normalized;
}

/**
 * Bank transfer to an account whose holder name was already confirmed by name
 * enquiry (the route resolves it; this builder trusts only that resolved name).
 */
export function draftBankTransfer(
  ctx: AppContext,
  user: UserRow,
  input: { bankId: string; accountNumber: string; resolvedName: string; amountMinor: number; note?: string },
  deviceId: string | null,
): PaymentDraft {
  const bank = bankFor(user, input.bankId);
  if (!ctx.providers.has(bank.id)) throw badRequest("This bank isn't available right now");
  const accountNumber = normalizeBankAccount(bank, input.accountNumber);
  return {
    ...base(user, "BANK_TRANSFER", input.amountMinor, deviceId),
    feeMinor: customerFeeMinor("BANK_TRANSFER", input.amountMinor),
    sourceAccountId: requireWallet(user),
    destinationAccountId: systemAccount(ctx, "BANK_SETTLEMENT", currencyOf(user), bank.id),
    counterpartyLabel: `${input.resolvedName} · ${bank.name} ••${accountNumber.slice(-4)}`,
    counterpartyKey: `bank:${bank.id}:${accountNumber}`,
    providerId: bank.id,
    note: input.note ?? "",
    metadata: { destination: accountNumber, accountName: input.resolvedName },
    minTier: MIN_TIER_FOR_SERVICE.BANK_TRANSFER,
  };
}

export function draftAirtime(
  ctx: AppContext,
  user: UserRow,
  input: { providerId: string; amountMinor: number; phoneNumber?: string },
  deviceId: string | null,
): PaymentDraft {
  const provider = country(user).mobileMoneyProviders.find((p) => p.id === input.providerId);
  if (!provider) throw badRequest("Choose a mobile network in your country");
  const phone = input.phoneNumber ?? user.phone;
  assertLocalPhone(user, phone);
  return {
    ...base(user, "AIRTIME", input.amountMinor, deviceId),
    feeMinor: customerFeeMinor("AIRTIME", input.amountMinor),
    sourceAccountId: requireWallet(user),
    destinationAccountId: systemAccount(ctx, "AIRTIME_CLEARING", currencyOf(user), provider.id),
    counterpartyLabel: `${provider.label} airtime · ${phone}`,
    counterpartyKey: `airtime:${phone}`,
    providerId: provider.id,
  };
}

export function draftBill(
  ctx: AppContext,
  user: UserRow,
  input: { billerId: string; accountNumber: string; amountMinor: number },
  deviceId: string | null,
): PaymentDraft {
  const biller = country(user).billers.find((b) => b.id === input.billerId);
  if (!biller) throw badRequest("Choose a biller in your country");
  const accountNumber = input.accountNumber.trim().toUpperCase();
  if (!new RegExp(biller.accountNumberPattern).test(accountNumber)) throw badRequest(`Enter a valid ${biller.accountNumberHint.toLowerCase()}`);
  return {
    ...base(user, "BILL_PAYMENT", input.amountMinor, deviceId),
    feeMinor: customerFeeMinor("BILL_PAYMENT", input.amountMinor),
    sourceAccountId: requireWallet(user),
    destinationAccountId: systemAccount(ctx, "BILLER_SETTLEMENT", currencyOf(user), biller.id),
    counterpartyLabel: `${biller.name} · ${accountNumber}`,
    counterpartyKey: `bill:${biller.id}:${accountNumber}`,
    metadata: { billerId: biller.id, accountNumber, issuesToken: biller.issuesToken },
  };
}

export function draftMerchant(
  ctx: AppContext,
  user: UserRow,
  input: { merchantCode: string; amountMinor: number; note?: string },
  deviceId: string | null,
): PaymentDraft {
  const found = findMerchant(input.merchantCode.trim().toUpperCase());
  if (!found || found.country.code !== user.country_code) throw notFound("Merchant code not found in your country");
  const merchantUser = one<UserRow>(ctx.db, "SELECT * FROM users WHERE merchant_code = ?", found.merchant.code);
  if (!merchantUser?.wallet_account_id) throw notFound("Merchant code not found in your country");
  return {
    ...base(user, "MERCHANT_PAYMENT", input.amountMinor, deviceId),
    merchantFeeMinor: merchantFeeMinor("MERCHANT_PAYMENT", input.amountMinor),
    sourceAccountId: requireWallet(user),
    destinationAccountId: merchantUser.wallet_account_id,
    counterpartyUserId: merchantUser.id,
    counterpartyLabel: found.merchant.name,
    counterpartyKey: `merchant:${found.merchant.code}`,
    note: input.note ?? "",
  };
}

interface QuoteRow {
  id: string;
  user_id: string;
  destination_country: string;
  send_currency: string;
  receive_currency: string;
  send_amount_minor: number;
  fee_minor: number;
  receive_amount_minor: number;
  rate: number;
  expires_at: string;
  used_at: string | null;
}

export function draftCrossBorder(
  ctx: AppContext,
  user: UserRow,
  input: { quoteId: string; destinationPhoneNumber: string; purposeCode: string },
  deviceId: string | null,
): PaymentDraft {
  const quote = one<QuoteRow>(ctx.db, "SELECT * FROM fx_quotes WHERE id = ?", input.quoteId);
  if (!quote || quote.user_id !== user.id) throw notFound("Quote not found");
  if (quote.used_at) throw conflict("This quote was already used. Get a new quote.");
  if (new Date(quote.expires_at) <= ctx.now()) throw conflict("This quote has expired. Get a new quote.");
  const recipient = getUserByPhone(ctx, input.destinationPhoneNumber);
  if (!recipient || recipient.country_code !== quote.destination_country) {
    throw notFound(`No Benki account in ${COUNTRY_BY_CODE[quote.destination_country].name} is registered to that number`);
  }
  if (!recipient.wallet_account_id || recipient.status === "CLOSED") throw badRequest("That person can't receive money yet");
  run(ctx.db, "UPDATE fx_quotes SET used_at = ? WHERE id = ?", ctx.nowIso(), quote.id);
  return {
    ...base(user, "CROSS_BORDER", quote.send_amount_minor, deviceId),
    feeMinor: quote.fee_minor,
    sourceAccountId: requireWallet(user),
    destinationAccountId: recipient.wallet_account_id,
    counterpartyUserId: recipient.id,
    counterpartyLabel: `${recipient.full_name ?? recipient.phone} (${COUNTRY_BY_CODE[recipient.country_code].name})`,
    counterpartyKey: `user:${recipient.id}`,
    purposeCode: input.purposeCode,
    receiveAmountMinor: quote.receive_amount_minor,
    receiveCurrency: quote.receive_currency,
    metadata: { quoteId: quote.id, rate: quote.rate },
    minTier: MIN_TIER_FOR_SERVICE.CROSS_BORDER,
    recipientCapUserId: recipient.id,
    recipientCapAmountMinor: quote.receive_amount_minor,
  };
}

export function draftSavings(
  ctx: AppContext,
  user: UserRow,
  vaultId: string,
  direction: "DEPOSIT" | "WITHDRAWAL",
  amountMinor: number,
): PaymentDraft {
  const vault = one<VaultRow>(ctx.db, "SELECT * FROM savings_vaults WHERE id = ? AND user_id = ?", vaultId, user.id);
  if (!vault) throw notFound("Savings vault not found");
  const wallet = requireWallet(user);
  const deposit = direction === "DEPOSIT";
  return {
    ...base(user, deposit ? "SAVINGS_DEPOSIT" : "SAVINGS_WITHDRAWAL", amountMinor, null),
    sourceAccountId: deposit ? wallet : vault.account_id,
    destinationAccountId: deposit ? vault.account_id : wallet,
    counterpartyLabel: `Savings: ${vault.name}`,
    metadata: { vaultId },
    minTier: MIN_TIER_FOR_SERVICE.SAVINGS,
    outflow: false,
    screen: false,
  };
}

// --- Back-office actions on transactions ------------------------------------

export function approveHeldTransaction(ctx: AppContext, txId: string, staff: StaffRow): { tx: TransactionRow; needsDispatch: boolean } {
  return withTx(ctx.db, () => {
    const tx = getTransaction(ctx, txId);
    if (!tx) throw notFound("Transaction not found");
    if (tx.status !== "PENDING_REVIEW") throw conflict("Only transactions pending review can be approved");
    const initiator = getUser(ctx, tx.initiator_user_id)!;
    if (initiator.status !== "ACTIVE") throw conflict("The customer's account is restricted — reject this transaction instead");
    resolveHolds(ctx, txId, "CAPTURED");
    if (tx.counterparty_user_id && (tx.type === "P2P" || tx.type === "CROSS_BORDER")) {
      enforceHoldingsCap(ctx, getUser(ctx, tx.counterparty_user_id)!, tx.receive_amount_minor ?? tx.amount_minor, false);
    }
    if (tx.type === "CASH_IN") enforceHoldingsCap(ctx, initiator, tx.amount_minor, true);
    const settled = settle(ctx, tx);
    closeAlertsForTransaction(ctx, txId, `APPROVED by ${staff.username}`);
    notifyCompleted(ctx, settled);
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "TRANSACTION_APPROVED", entityType: "transaction", entityId: txId });
    return { tx: settled, needsDispatch: settled.status === "PENDING" };
  });
}

export function rejectHeldTransaction(ctx: AppContext, txId: string, staff: StaffRow, reason: string): TransactionRow {
  if (reason.trim().length < 10) throw badRequest("Record the reason for rejecting (10+ characters)");
  return withTx(ctx.db, () => {
    const tx = getTransaction(ctx, txId);
    if (!tx) throw notFound("Transaction not found");
    if (tx.status !== "PENDING_REVIEW") throw conflict("Only transactions pending review can be rejected");
    resolveHolds(ctx, txId, "RELEASED");
    run(ctx.db, "UPDATE transactions SET status = 'REJECTED', updated_at = ? WHERE id = ?", ctx.nowIso(), txId);
    closeAlertsForTransaction(ctx, txId, `REJECTED by ${staff.username}: ${reason}`);
    notify(
      ctx,
      tx.initiator_user_id,
      "TRANSACTION",
      `Your ${TYPE_LABEL[tx.type].toLowerCase()} of ${formatAmount(tx.amount_minor, tx.currency)} couldn't be completed. Any reserved funds are available again. Ref ${tx.id}.`,
    );
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "TRANSACTION_REJECTED", entityType: "transaction", entityId: txId, details: { reason } });
    return getTransaction(ctx, txId)!;
  });
}

const REVERSIBLE = new Set<TransactionType>(["P2P", "MERCHANT_PAYMENT", "BILL_PAYMENT", "AIRTIME", "CROSS_BORDER", "CASH_IN"]);

export function assertReversible(tx: TransactionRow | undefined): TransactionRow {
  if (!tx) throw notFound("Transaction not found");
  if (tx.status !== "COMPLETED") throw conflict("Only completed transactions can be reversed");
  if (!REVERSIBLE.has(tx.type)) {
    throw conflict(
      tx.type === "MOBILE_MONEY_PAYOUT" || tx.type === "BANK_TRANSFER"
        ? "Payouts to external rails must be recalled through the provider"
        : `${TYPE_LABEL[tx.type]} transactions can't be reversed in the ledger`,
    );
  }
  return tx;
}

/** Compensating reversal — executed only through an approved four-eyes request. */
export function reverseTransaction(ctx: AppContext, txId: string, staffId: string, reason: string): TransactionRow {
  return withTx(ctx.db, () => {
    const tx = assertReversible(getTransaction(ctx, txId));
    const paymentEntry = entriesForTransaction(ctx, txId).find((e) => e.kind === "PAYMENT");
    if (!paymentEntry) throw conflict("No ledger entry found for this transaction");
    const reversalId = newId("TXN");
    const now = ctx.nowIso();
    run(
      ctx.db,
      `INSERT INTO transactions (id, type, status, initiator_user_id, counterparty_user_id, source_account_id, destination_account_id,
         amount_minor, fee_minor, currency, receive_amount_minor, receive_currency, counterparty_label, note, reversal_of, metadata,
         created_at, updated_at, completed_at)
       VALUES (?, 'REVERSAL', 'COMPLETED', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      reversalId,
      tx.initiator_user_id,
      tx.counterparty_user_id,
      tx.destination_account_id,
      tx.source_account_id,
      tx.amount_minor + tx.fee_minor,
      tx.currency,
      tx.receive_amount_minor ?? (tx.counterparty_user_id ? tx.amount_minor : null),
      tx.receive_currency ?? (tx.counterparty_user_id ? tx.currency : null),
      `Reversal: ${tx.counterparty_label}`,
      reason,
      tx.id,
      JSON.stringify({ originalType: tx.type, reason }),
      now,
      now,
      now,
    );
    try {
      reverseEntry(ctx, paymentEntry.id, reversalId, `Reversal of ${tx.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === "INSUFFICIENT_FUNDS") {
        throw conflict("The receiving account no longer holds enough funds to reverse this payment");
      }
      throw error;
    }
    run(ctx.db, "UPDATE transactions SET status = 'REVERSED', updated_at = ? WHERE id = ?", now, tx.id);
    notify(ctx, tx.initiator_user_id, "TRANSACTION", `${TYPE_LABEL[tx.type]} ${tx.id} was reversed. ${formatAmount(tx.amount_minor + tx.fee_minor, tx.currency)} has been returned to you.`);
    if (tx.counterparty_user_id) {
      notify(ctx, tx.counterparty_user_id, "TRANSACTION", `A payment you received (ref ${tx.id}) was reversed after a review.`);
    }
    audit(ctx, { actorType: "STAFF", actorId: staffId, action: "TRANSACTION_REVERSED", entityType: "transaction", entityId: tx.id, details: { reversalId, reason } });
    return getTransaction(ctx, reversalId)!;
  });
}

/** Ops correction against the suspense account — executed only through four-eyes approval. */
export function manualAdjustment(ctx: AppContext, userId: string, deltaMinor: number, memo: string, staffId: string): TransactionRow {
  return withTx(ctx.db, () => {
    const user = getUser(ctx, userId);
    if (!user) throw notFound("User not found");
    const wallet = requireWallet(user);
    const currency = currencyOf(user);
    const suspense = systemAccount(ctx, "SUSPENSE", currency);
    const id = newId("TXN");
    const now = ctx.nowIso();
    const credit = deltaMinor > 0;
    run(
      ctx.db,
      `INSERT INTO transactions (id, type, status, initiator_user_id, source_account_id, destination_account_id, amount_minor,
         currency, counterparty_label, note, metadata, created_at, updated_at, completed_at)
       VALUES (?, 'ADJUSTMENT', 'COMPLETED', ?, ?, ?, ?, ?, 'Account adjustment', ?, ?, ?, ?, ?)`,
      id,
      userId,
      credit ? suspense : wallet,
      credit ? wallet : suspense,
      Math.abs(deltaMinor),
      currency,
      memo,
      JSON.stringify({ direction: credit ? "CREDIT" : "DEBIT", memo }),
      now,
      now,
      now,
    );
    postEntry(ctx, {
      transactionId: id,
      kind: "ADJUSTMENT",
      description: memo,
      postings: [
        { accountId: wallet, amountMinor: deltaMinor },
        { accountId: suspense, amountMinor: -deltaMinor },
      ],
    });
    notify(ctx, userId, "TRANSACTION", `Account adjustment: ${credit ? "+" : "-"}${formatAmount(Math.abs(deltaMinor), currency)}. ${memo}`);
    audit(ctx, { actorType: "STAFF", actorId: staffId, action: "MANUAL_ADJUSTMENT_POSTED", entityType: "transaction", entityId: id, details: { userId, deltaMinor, memo } });
    return getTransaction(ctx, id)!;
  });
}
