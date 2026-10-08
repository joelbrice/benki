import {
  COUNTRY_BY_CODE,
  formatAmount,
  tierLimits,
  type LimitsResponse,
  type TransactionType,
} from "@benki/shared";
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
];

/** Attempted value counts against limits even while pending or held for review. */
export const LIMIT_COUNTED_STATUSES = ["COMPLETED", "PENDING", "PENDING_REVIEW"];

const inList = (values: string[]) => values.map((v) => `'${v}'`).join(",");

export function outflowSince(ctx: AppContext, userId: string, since: Date): number {
  const row = one<{ total: number | null }>(
    ctx.db,
    `SELECT SUM(amount_minor) AS total FROM transactions
     WHERE initiator_user_id = ? AND created_at >= ?
       AND type IN (${inList(OUTFLOW_TYPES)}) AND status IN (${inList(LIMIT_COUNTED_STATUSES)})`,
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
  const fmt = (n: number) => formatAmount(n, usage.currency);
  const upgradeHint = user.kyc_tier === "TIER_2" ? "" : " Verify your identity to raise your limits.";
  if (amountMinor > usage.perTransactionMinor) {
    throw limitExceeded(`The most you can send in one payment is ${fmt(usage.perTransactionMinor)}.${upgradeHint}`);
  }
  if (usage.dailyUsedMinor + amountMinor > usage.dailyLimitMinor) {
    const left = Math.max(0, usage.dailyLimitMinor - usage.dailyUsedMinor);
    throw limitExceeded(`This would exceed your daily limit of ${fmt(usage.dailyLimitMinor)}. You can send ${fmt(left)} more today.${upgradeHint}`);
  }
  if (usage.monthlyUsedMinor + amountMinor > usage.monthlyLimitMinor) {
    const left = Math.max(0, usage.monthlyLimitMinor - usage.monthlyUsedMinor);
    throw limitExceeded(`This would exceed your 30-day limit of ${fmt(usage.monthlyLimitMinor)}. You can send ${fmt(left)} more.${upgradeHint}`);
  }
}

/** E-money balance cap: total holdings may not exceed the tier's maximum balance. */
export function enforceHoldingsCap(ctx: AppContext, recipient: UserRow, incomingMinor: number, isSelf: boolean) {
  if (recipient.kind === "MERCHANT") return;
  const limits = tierLimits(recipient.country_code, recipient.kyc_tier);
  if (totalHoldings(ctx, recipient.id) + incomingMinor <= limits.maxBalanceMinor) return;
  if (!isSelf) throw limitExceeded("The recipient can't receive this amount right now.");
  throw limitExceeded(
    `This would take your balance over the ${formatAmount(limits.maxBalanceMinor, currencyOf(recipient))} maximum for your verification level.` +
      (recipient.kyc_tier === "TIER_2" ? "" : " Verify your identity to raise it."),
  );
}
