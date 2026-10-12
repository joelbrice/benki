import {
  COUNTRY_BY_CODE,
  formatAmount,
  tierLimits,
  type LimitsResponse,
  type TransactionType, msg, money } from "@benki/shared";
import type { AppContext } from "../context";
import { one } from "../db/query";
import type { UserRow } from "../db/rows";
import { DAY } from "../lib/clock";
import { limitExceeded } from "../lib/errors";
import { totalHoldings } from "./users";

export const OUTFLOW_TYPES: TransactionType[] = [
  "CASH_OUT",
  "P2P",
  "MOBILE_MONEY_PAYOUT",
  "AIRTIME",
  "BILL_PAYMENT",
  "MERCHANT_PAYMENT",
  "CROSS_BORDER",
  "BANK_TRANSFER",
  "GROUP_CONTRIBUTION",
  "FX_CONVERSION",
];

/**
 * Limits and risk thresholds are in the customer's local currency, so sums
 * only include transactions denominated in it (selling a USD pocket back to
 * the wallet is not an outflow of local money).
 */
export const LOCAL_CURRENCY_ONLY =
  "currency = (SELECT a.currency FROM accounts a JOIN users u ON u.wallet_account_id = a.id WHERE u.id = initiator_user_id)";

/** Attempted value counts against limits even while pending or held for review. */
export const LIMIT_COUNTED_STATUSES = ["COMPLETED", "PENDING", "PENDING_REVIEW"];

const inList = (values: string[]) => values.map((v) => `'${v}'`).join(",");

export function outflowSince(ctx: AppContext, userId: string, since: Date): number {
  const row = one<{ total: number | null }>(
    ctx.db,
    `SELECT SUM(amount_minor) AS total FROM transactions
     WHERE initiator_user_id = ? AND created_at >= ?
       AND type IN (${inList(OUTFLOW_TYPES)}) AND status IN (${inList(LIMIT_COUNTED_STATUSES)})
       AND ${LOCAL_CURRENCY_ONLY}`,
    userId,
    since.toISOString(),
  );
  return row?.total ?? 0;
}

export function currencyOf(user: UserRow): string {
  return COUNTRY_BY_CODE[user.country_code].currency;
}

export function limitsUsage(ctx: AppContext, user: UserRow): LimitsResponse {
  const limits = tierLimits(user.country_code, user.kyc_tier);
  const now = ctx.now().getTime();
  return {
    kycTier: user.kyc_tier,
    currency: currencyOf(user),
    perTransactionMinor: limits.perTransactionMinor,
    dailyLimitMinor: limits.dailyMinor,
    dailyUsedMinor: outflowSince(ctx, user.id, new Date(now - DAY)),
    monthlyLimitMinor: limits.monthlyMinor,
    monthlyUsedMinor: outflowSince(ctx, user.id, new Date(now - 30 * DAY)),
    maxBalanceMinor: limits.maxBalanceMinor,
    totalHoldingsMinor: totalHoldings(ctx, user.id),
  };
}

export function enforceOutflowLimits(ctx: AppContext, user: UserRow, amountMinor: number) {
  const usage = limitsUsage(ctx, user);
  const amt = (n: number) => money(n, usage.currency);
  // The upgrade hint is added by the apps (they know the customer's tier); the message stays factual.
  if (amountMinor > usage.perTransactionMinor) {
    throw limitExceeded(msg("err.limitPerTx", { limit: amt(usage.perTransactionMinor) }));
  }
  if (usage.dailyUsedMinor + amountMinor > usage.dailyLimitMinor) {
    const left = Math.max(0, usage.dailyLimitMinor - usage.dailyUsedMinor);
    throw limitExceeded(msg("err.limitDaily", { limit: amt(usage.dailyLimitMinor), left: amt(left) }));
  }
  if (usage.monthlyUsedMinor + amountMinor > usage.monthlyLimitMinor) {
    const left = Math.max(0, usage.monthlyLimitMinor - usage.monthlyUsedMinor);
    throw limitExceeded(msg("err.limitMonthly", { limit: amt(usage.monthlyLimitMinor), left: amt(left) }));
  }
}

/** E-money balance cap: total holdings may not exceed the tier's maximum balance. */
export function enforceHoldingsCap(ctx: AppContext, recipient: UserRow, incomingMinor: number, isSelf: boolean) {
  if (recipient.kind === "MERCHANT") return;
  const limits = tierLimits(recipient.country_code, recipient.kyc_tier);
  if (totalHoldings(ctx, recipient.id) + incomingMinor <= limits.maxBalanceMinor) return;
  if (!isSelf) throw limitExceeded(msg("err.recipientCap"));
  throw limitExceeded(msg("err.balanceCap", { limit: money(limits.maxBalanceMinor, currencyOf(recipient)) }));
}
