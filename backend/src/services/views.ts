import type { AdminTransaction, Direction, TransactionStatus, TransactionType, UserTransaction } from "@benki/shared";
import type { AppContext } from "../context";
import { one } from "../db/query";
import type { TransactionRow } from "../db/rows";

const CREDIT_TO_INITIATOR = new Set<TransactionType>(["CASH_IN", "SAVINGS_WITHDRAWAL"]);
export const DISPUTABLE_TYPES = new Set<TransactionType>([
  "P2P",
  "MERCHANT_PAYMENT",
  "BILL_PAYMENT",
  "AIRTIME",
  "CROSS_BORDER",
  "MOBILE_MONEY_PAYOUT",
]);
export const DISPUTE_WINDOW_DAYS = 120;

function flip(d: Direction): Direction {
  return d === "CREDIT" ? "DEBIT" : "CREDIT";
}

export function directionFor(tx: TransactionRow, userId: string): Direction {
  const meta = JSON.parse(tx.metadata) as { direction?: Direction; originalType?: TransactionType };
  if (tx.type === "ADJUSTMENT") return meta.direction ?? "CREDIT";
  const isInitiator = tx.initiator_user_id === userId;
  if (tx.type === "REVERSAL") {
    const originalType = meta.originalType ?? "P2P";
    const original: Direction = isInitiator ? (CREDIT_TO_INITIATOR.has(originalType) ? "CREDIT" : "DEBIT") : "CREDIT";
    return flip(original);
  }
  if (!isInitiator) return "CREDIT";
  return CREDIT_TO_INITIATOR.has(tx.type) ? "CREDIT" : "DEBIT";
}

/**
 * Customer-facing status. Compliance outcomes are folded into FAILED so the
 * app never reveals that a payment was blocked or rejected by AML controls.
 */
function customerStatus(status: TransactionStatus): TransactionStatus {
  return status === "BLOCKED" || status === "REJECTED" ? "FAILED" : status;
}

function displayName(ctx: AppContext, userId: string | null): string | null {
  if (!userId) return null;
  const u = one<{ full_name: string | null; phone: string; kind: string }>(
    ctx.db,
    "SELECT full_name, phone, kind FROM users WHERE id = ?",
    userId,
  );
  if (!u) return null;
  return u.full_name ?? u.phone;
}

export function toUserTransaction(ctx: AppContext, tx: TransactionRow, userId: string): UserTransaction {
  const isInitiator = tx.initiator_user_id === userId;
  const direction = directionFor(tx, userId);
  const receivingSide = !isInitiator && tx.receive_amount_minor !== null;
  const ageDays = (ctx.now().getTime() - new Date(tx.created_at).getTime()) / 86_400_000;
  const disputable =
    isInitiator &&
    tx.status === "COMPLETED" &&
    DISPUTABLE_TYPES.has(tx.type) &&
    ageDays <= DISPUTE_WINDOW_DAYS &&
    !one(ctx.db, "SELECT id FROM disputes WHERE transaction_id = ?", tx.id);

  return {
    id: tx.id,
    type: tx.type,
    direction,
    status: customerStatus(tx.status),
    amountMinor: receivingSide ? tx.receive_amount_minor! : tx.amount_minor,
    feeMinor: isInitiator ? tx.fee_minor : 0,
    currency: receivingSide ? tx.receive_currency! : tx.currency,
    counterparty: isInitiator ? tx.counterparty_label : (displayName(ctx, tx.initiator_user_id) ?? "Benki user"),
    note: tx.note,
    createdAt: tx.created_at,
    completedAt: tx.completed_at,
    receiveAmountMinor: isInitiator ? tx.receive_amount_minor : null,
    receiveCurrency: isInitiator ? tx.receive_currency : null,
    token: isInitiator ? tx.token : null,
    disputable,
  };
}

export function toAdminTransaction(ctx: AppContext, tx: TransactionRow): AdminTransaction {
  const initiator = one<{ phone: string }>(ctx.db, "SELECT phone FROM users WHERE id = ?", tx.initiator_user_id);
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amountMinor: tx.amount_minor,
    feeMinor: tx.fee_minor,
    currency: tx.currency,
    counterparty: tx.counterparty_label,
    note: tx.note,
    createdAt: tx.created_at,
    completedAt: tx.completed_at,
    receiveAmountMinor: tx.receive_amount_minor,
    receiveCurrency: tx.receive_currency,
    token: tx.token,
    initiatorUserId: tx.initiator_user_id,
    initiatorPhone: initiator?.phone ?? "",
    counterpartyUserId: tx.counterparty_user_id,
    riskDecision: tx.risk_decision,
    riskScore: tx.risk_score,
    ruleHits: JSON.parse(tx.rule_hits),
    providerId: tx.provider_id,
    providerRef: tx.provider_ref,
  };
}
