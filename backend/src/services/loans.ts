import {
  formatAmount,
  LOAN_PRODUCT,
  loanAprPercent,
  loanFeeMinor,
  MIN_TIER_FOR_SERVICE,
  minorUnitsPerMajor,
  tierAtLeast,
  tierLimits,
  type Loan,
  type LoanOffer,
  type LoanStatus,
} from "@benki/shared";
import type { AppContext } from "../context";
import { all, one, run } from "../db/query";
import type { TransactionRow, UserRow } from "../db/rows";
import { DAY } from "../lib/clock";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { systemAccount } from "./accounts";
import { audit } from "./audit";
import { currencyOf } from "./limits";
import { notify } from "./notifications";
import { requireWallet, type PaymentDraft } from "./payments";

interface LoanRow {
  id: string;
  user_id: string;
  currency: string;
  principal_minor: number;
  fee_minor: number;
  repaid_minor: number;
  disbursement_tx_id: string | null;
  disbursed_at: string;
  due_at: string;
  repaid_at: string | null;
}

/** Deliberately generic: a customer under investigation must not learn why. */
const NOT_AVAILABLE = "Loans aren't available for this account right now.";

function statusOf(ctx: AppContext, row: LoanRow): LoanStatus {
  if (row.repaid_at) return "REPAID";
  return new Date(row.due_at) < ctx.now() ? "OVERDUE" : "ACTIVE";
}

function toLoan(ctx: AppContext, row: LoanRow): Loan {
  const total = row.principal_minor + row.fee_minor;
  return {
    loanId: row.id,
    currency: row.currency,
    principalMinor: row.principal_minor,
    feeMinor: row.fee_minor,
    totalDueMinor: total,
    repaidMinor: row.repaid_minor,
    outstandingMinor: total - row.repaid_minor,
    status: statusOf(ctx, row),
    disbursedAt: row.disbursed_at,
    dueAt: row.due_at,
    repaidAt: row.repaid_at,
  };
}

export function listLoans(ctx: AppContext, userId: string): Loan[] {
  return all<LoanRow>(ctx.db, "SELECT * FROM loans WHERE user_id = ? ORDER BY disbursed_at DESC", userId).map((r) => toLoan(ctx, r));
}

/** Completed money received in the last 90 days — the basis for affordability. */
function recentInflows(ctx: AppContext, userId: string): { count: number; totalMinor: number } {
  const since = new Date(ctx.now().getTime() - 90 * DAY).toISOString();
  const row = one<{ n: number; total: number | null }>(
    ctx.db,
    `SELECT COUNT(*) AS n, SUM(COALESCE(receive_amount_minor, amount_minor)) AS total FROM transactions
     WHERE status = 'COMPLETED' AND created_at >= ? AND (
       (counterparty_user_id = ? AND type IN ('P2P', 'CROSS_BORDER', 'MERCHANT_PAYMENT'))
       OR (initiator_user_id = ? AND type = 'CASH_IN'))`,
    since,
    userId,
    userId,
  )!;
  return { count: row.n, totalMinor: row.total ?? 0 };
}

/**
 * Responsible-lending checks: verified identity, an active account, no
 * outstanding loan, no open compliance case or alert, a real income history,
 * and a ceiling tied to both the tier's limits and recent inflows.
 */
export function loanOffer(ctx: AppContext, user: UserRow): LoanOffer {
  const currency = currencyOf(user);
  const minPrincipal = LOAN_PRODUCT.minPrincipalMajor * minorUnitsPerMajor(currency);
  const reasons: string[] = [];
  let max = 0;

  if (!tierAtLeast(user.kyc_tier, MIN_TIER_FOR_SERVICE.LOANS)) {
    reasons.push("Verify your identity (Tier 1) to borrow.");
  } else if (user.status !== "ACTIVE" || underInvestigation(ctx, user.id)) {
    reasons.push(NOT_AVAILABLE);
  } else if (one(ctx.db, "SELECT id FROM loans WHERE user_id = ? AND repaid_at IS NULL", user.id)) {
    reasons.push("Repay your current loan before taking another.");
  } else {
    const inflows = recentInflows(ctx, user.id);
    if (inflows.count < LOAN_PRODUCT.minCompletedInflows) {
      reasons.push(`Receive money into Benki at least ${LOAN_PRODUCT.minCompletedInflows} times to qualify.`);
    } else {
      const byLimit = tierLimits(user.country_code, user.kyc_tier).perTransactionMinor * LOAN_PRODUCT.maxShareOfPerTransactionLimit;
      const byIncome = inflows.totalMinor * LOAN_PRODUCT.maxShareOfRecentInflows;
      const unit = minorUnitsPerMajor(currency);
      max = Math.floor(Math.min(byLimit, byIncome) / unit) * unit;
      if (max < minPrincipal) {
        max = 0;
        reasons.push("Your recent activity doesn't support a loan yet. Keep using Benki and check back.");
      }
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    currency,
    minPrincipalMinor: minPrincipal,
    maxPrincipalMinor: max,
    feeBps: LOAN_PRODUCT.feeBps,
    termDays: LOAN_PRODUCT.termDays,
    aprPercent: loanAprPercent(),
  };
}

function underInvestigation(ctx: AppContext, userId: string): boolean {
  return Boolean(
    one(ctx.db, "SELECT id FROM cases WHERE user_id = ? AND status = 'OPEN'", userId) ??
      one(ctx.db, "SELECT id FROM alerts WHERE user_id = ? AND status = 'OPEN'", userId),
  );
}

export function draftLoanDisbursement(ctx: AppContext, user: UserRow, principalMinor: number): PaymentDraft {
  const offer = loanOffer(ctx, user);
  if (!offer.eligible) {
    throw offer.reasons[0] === NOT_AVAILABLE ? forbidden(NOT_AVAILABLE) : conflict(offer.reasons[0]);
  }
  if (principalMinor < offer.minPrincipalMinor || principalMinor > offer.maxPrincipalMinor) {
    throw badRequest(
      `Choose an amount between ${formatAmount(offer.minPrincipalMinor, offer.currency)} and ${formatAmount(offer.maxPrincipalMinor, offer.currency)}.`,
    );
  }
  const fee = loanFeeMinor(principalMinor);
  const dueAt = new Date(ctx.now().getTime() + LOAN_PRODUCT.termDays * DAY).toISOString();
  return {
    type: "LOAN_DISBURSEMENT",
    userId: user.id,
    amountMinor: principalMinor,
    feeMinor: 0,
    merchantFeeMinor: 0,
    currency: offer.currency,
    sourceAccountId: systemAccount(ctx, "LOAN_BOOK", offer.currency),
    destinationAccountId: requireWallet(user),
    counterpartyUserId: null,
    counterpartyLabel: "Benki nano-loan",
    counterpartyKey: null,
    note: `Repay ${formatAmount(principalMinor + fee, offer.currency)} by ${dueAt.slice(0, 10)}`,
    providerId: null,
    purposeCode: null,
    receiveAmountMinor: null,
    receiveCurrency: null,
    metadata: { loanFeeMinor: fee, dueAt },
    minTier: MIN_TIER_FOR_SERVICE.LOANS,
    outflow: false,
    checkFunds: false,
    screen: false,
    recipientCapUserId: user.id,
    recipientCapAmountMinor: principalMinor,
    deviceId: null,
  };
}

/** Books the loan once its disbursement has posted. Runs in the payment's DB transaction. */
export function recordLoan(ctx: AppContext, tx: TransactionRow): Loan {
  const meta = JSON.parse(tx.metadata) as { loanFeeMinor: number; dueAt: string };
  const id = newId("LON");
  run(
    ctx.db,
    `INSERT INTO loans (id, user_id, currency, principal_minor, fee_minor, repaid_minor, disbursement_tx_id, disbursed_at, due_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    id,
    tx.initiator_user_id,
    tx.currency,
    tx.amount_minor,
    meta.loanFeeMinor,
    tx.id,
    ctx.nowIso(),
    meta.dueAt,
  );
  audit(ctx, {
    actorType: "USER",
    actorId: tx.initiator_user_id,
    action: "LOAN_DISBURSED",
    entityType: "loan",
    entityId: id,
    details: { principalMinor: tx.amount_minor, feeMinor: meta.loanFeeMinor, dueAt: meta.dueAt, transactionId: tx.id },
  });
  return toLoan(ctx, one<LoanRow>(ctx.db, "SELECT * FROM loans WHERE id = ?", id)!);
}

function ownLoan(ctx: AppContext, userId: string, loanId: string): LoanRow {
  const row = one<LoanRow>(ctx.db, "SELECT * FROM loans WHERE id = ? AND user_id = ?", loanId, userId);
  if (!row) throw notFound("Loan not found");
  return row;
}

export function draftLoanRepayment(ctx: AppContext, user: UserRow, loanId: string, amountMinor: number): PaymentDraft {
  const loan = ownLoan(ctx, user.id, loanId);
  if (loan.repaid_at) throw conflict("This loan is already repaid");
  const outstanding = loan.principal_minor + loan.fee_minor - loan.repaid_minor;
  if (amountMinor > outstanding) throw badRequest(`You only owe ${formatAmount(outstanding, loan.currency)}.`);
  const feePortion = Math.min(amountMinor, Math.max(0, loan.fee_minor - loan.repaid_minor));
  return {
    type: "LOAN_REPAYMENT",
    userId: user.id,
    amountMinor,
    feeMinor: 0,
    merchantFeeMinor: 0,
    currency: loan.currency,
    sourceAccountId: requireWallet(user),
    destinationAccountId: systemAccount(ctx, "LOAN_BOOK", loan.currency),
    counterpartyUserId: null,
    counterpartyLabel: "Benki nano-loan repayment",
    counterpartyKey: null,
    note: "",
    providerId: null,
    purposeCode: null,
    receiveAmountMinor: null,
    receiveCurrency: null,
    metadata: { loanId, feePortionMinor: feePortion },
    minTier: "TIER_0",
    // Paying back debt is never blocked by spending limits.
    outflow: false,
    checkFunds: true,
    screen: false,
    recipientCapUserId: null,
    recipientCapAmountMinor: 0,
    deviceId: null,
  };
}

export function applyRepayment(ctx: AppContext, tx: TransactionRow): Loan {
  const { loanId } = JSON.parse(tx.metadata) as { loanId: string };
  const loan = ownLoan(ctx, tx.initiator_user_id, loanId);
  const repaid = loan.repaid_minor + tx.amount_minor;
  const done = repaid === loan.principal_minor + loan.fee_minor;
  run(ctx.db, "UPDATE loans SET repaid_minor = ?, repaid_at = ? WHERE id = ?", repaid, done ? ctx.nowIso() : null, loanId);
  audit(ctx, {
    actorType: "USER",
    actorId: tx.initiator_user_id,
    action: done ? "LOAN_REPAID" : "LOAN_PART_REPAID",
    entityType: "loan",
    entityId: loanId,
    details: { amountMinor: tx.amount_minor, transactionId: tx.id },
  });
  if (done) notify(ctx, tx.initiator_user_id, "ACCOUNT", "Your loan is fully repaid. Thank you!");
  return toLoan(ctx, ownLoan(ctx, tx.initiator_user_id, loanId));
}

export function loanBook(ctx: AppContext) {
  const open = all<LoanRow>(ctx.db, "SELECT * FROM loans WHERE repaid_at IS NULL");
  const byCurrency = new Map<string, { currency: string; activeLoans: number; overdueLoans: number; outstandingMinor: number }>();
  for (const row of open) {
    const entry = byCurrency.get(row.currency) ?? { currency: row.currency, activeLoans: 0, overdueLoans: 0, outstandingMinor: 0 };
    if (statusOf(ctx, row) === "OVERDUE") entry.overdueLoans++;
    else entry.activeLoans++;
    entry.outstandingMinor += row.principal_minor + row.fee_minor - row.repaid_minor;
    byCurrency.set(row.currency, entry);
  }
  return [...byCurrency.values()];
}
