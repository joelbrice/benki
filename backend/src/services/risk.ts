import { tierLimits, type RiskDecision, type RuleHit, type TransactionType } from "@benki/shared";
import type { AppContext } from "../context";
import { one } from "../db/query";
import type { UserRow } from "../db/rows";
import { DAY, HOUR, MINUTE } from "../lib/clock";
import { deviceFirstSeen } from "./auth";
import { LIMIT_COUNTED_STATUSES, OUTFLOW_TYPES } from "./limits";
import { getUser } from "./users";

export interface RiskInput {
  user: UserRow;
  type: TransactionType;
  amountMinor: number;
  deviceId: string | null;
  counterpartyUserId: string | null;
  /** Stable identifier of who/what is being paid (phone, merchant code, biller+account). */
  counterpartyKey: string | null;
}

export interface RiskResult {
  decision: RiskDecision;
  score: number;
  hits: RuleHit[];
}

// Tunable thresholds. docs/KYC_AML_POLICY_AND_RISK.md section 4 requires rule
// tuning to go through an approval workflow; in production these live in a
// versioned rules table rather than in code.
export const RISK_RULES = {
  REVIEW_SCORE_THRESHOLD: 80,
  VELOCITY_MAX_PER_HOUR: 5,
  STRUCTURING_BAND_LOW: 0.8,
  STRUCTURING_PRIOR_COUNT: 2,
  STRUCTURING_WINDOW_MS: 7 * DAY,
  PASS_THROUGH_WINDOW_MS: 60 * MINUTE,
  PASS_THROUGH_RATIO: 0.8,
  PASS_THROUGH_MIN_SHARE_OF_LIMIT: 0.2,
  DORMANT_AFTER_MS: 90 * DAY,
  DORMANT_MIN_SHARE_OF_LIMIT: 0.3,
  NEW_DEVICE_WINDOW_MS: 24 * HOUR,
  NEW_DEVICE_MIN_SHARE_OF_LIMIT: 0.5,
  SIM_SWAP_WINDOW_HOURS: 72,
  CROSS_BORDER_EDD_SHARE_OF_LIMIT: 0.5,
  FIRST_PAYEE_MIN_SHARE_OF_LIMIT: 0.7,
} as const;

const inList = (values: string[]) => values.map((v) => `'${v}'`).join(",");

function sumOne(ctx: AppContext, sql: string, ...params: (string | number)[]): number {
  return one<{ v: number | null }>(ctx.db, sql, ...params)?.v ?? 0;
}

/**
 * Evaluates the transaction-monitoring scenarios in
 * docs/KYC_AML_POLICY_AND_RISK.md section 2 (structuring/smurfing, velocity,
 * dormant-to-active, high-risk patterns) plus account-takeover signals.
 * Runs before any money moves; the result is stored on the transaction for
 * the audit trail and drives alerting.
 */
export function assessRisk(ctx: AppContext, input: RiskInput): RiskResult {
  const { user, amountMinor, type } = input;
  const now = ctx.now().getTime();
  const perTx = tierLimits(user.country_code, user.kyc_tier).perTransactionMinor;
  const isOutflow = OUTFLOW_TYPES.includes(type);
  const hits: RuleHit[] = [];
  const hit = (code: string, description: string, outcome: RiskDecision, score: number) =>
    hits.push({ code, description, outcome, score });
  const sinceIso = (ms: number) => new Date(now - ms).toISOString();

  if (input.counterpartyUserId) {
    const counterparty = getUser(ctx, input.counterpartyUserId);
    if (counterparty && (counterparty.screening_status === "CONFIRMED_MATCH" || counterparty.status === "FROZEN")) {
      hit("RESTRICTED_COUNTERPARTY", "Counterparty is frozen or a confirmed sanctions match", "BLOCK", 100);
    }
  }

  if (isOutflow) {
    const swapHours = ctx.telco.simSwapWithinHours(user.phone);
    if (swapHours !== null && swapHours <= RISK_RULES.SIM_SWAP_WINDOW_HOURS) {
      hit("SIM_SWAP_RECENT", `Telco reports a SIM swap ${swapHours}h ago`, "REVIEW", 60);
    }

    if (input.deviceId) {
      const firstSeen = deviceFirstSeen(ctx, user.id, input.deviceId);
      const accountAge = now - new Date(user.created_at).getTime();
      if (
        firstSeen &&
        now - firstSeen.getTime() < RISK_RULES.NEW_DEVICE_WINDOW_MS &&
        accountAge > RISK_RULES.NEW_DEVICE_WINDOW_MS &&
        amountMinor >= perTx * RISK_RULES.NEW_DEVICE_MIN_SHARE_OF_LIMIT
      ) {
        hit("NEW_DEVICE_HIGH_VALUE", "High-value payment from a device first seen in the last 24h", "REVIEW", 60);
      }
    }

    const lastHourCount = sumOne(
      ctx,
      `SELECT COUNT(*) AS v FROM transactions WHERE initiator_user_id = ? AND created_at >= ?
       AND type IN (${inList(OUTFLOW_TYPES)}) AND status IN (${inList(LIMIT_COUNTED_STATUSES)})`,
      user.id,
      sinceIso(HOUR),
    );
    if (lastHourCount >= RISK_RULES.VELOCITY_MAX_PER_HOUR) {
      hit("VELOCITY_HOURLY", `${lastHourCount + 1} outgoing payments within an hour`, "REVIEW", 50);
    }

    const inflow = sumOne(
      ctx,
      `SELECT SUM(COALESCE(receive_amount_minor, amount_minor)) AS v FROM transactions
       WHERE status = 'COMPLETED' AND created_at >= ? AND (
         (initiator_user_id = ? AND type = 'CASH_IN') OR
         (counterparty_user_id = ? AND type IN ('P2P', 'CROSS_BORDER')))`,
      sinceIso(RISK_RULES.PASS_THROUGH_WINDOW_MS),
      user.id,
      user.id,
    );
    if (inflow > 0 && amountMinor >= perTx * RISK_RULES.PASS_THROUGH_MIN_SHARE_OF_LIMIT) {
      const recentOut = sumOne(
        ctx,
        `SELECT SUM(amount_minor) AS v FROM transactions WHERE initiator_user_id = ? AND created_at >= ?
         AND type IN (${inList(OUTFLOW_TYPES)}) AND status IN (${inList(LIMIT_COUNTED_STATUSES)})`,
        user.id,
        sinceIso(RISK_RULES.PASS_THROUGH_WINDOW_MS),
      );
      if (recentOut + amountMinor >= inflow * RISK_RULES.PASS_THROUGH_RATIO) {
        hit("RAPID_PASS_THROUGH", "Most recently received funds are leaving within the hour (possible mule activity)", "REVIEW", 60);
      }
    }

    if (
      user.last_activity_at &&
      now - new Date(user.last_activity_at).getTime() > RISK_RULES.DORMANT_AFTER_MS &&
      amountMinor >= perTx * RISK_RULES.DORMANT_MIN_SHARE_OF_LIMIT
    ) {
      hit("DORMANT_REACTIVATION", "Large payment from an account dormant for 90+ days", "REVIEW", 50);
    }

    if (type === "CROSS_BORDER" && amountMinor >= perTx * RISK_RULES.CROSS_BORDER_EDD_SHARE_OF_LIMIT) {
      hit("CROSS_BORDER_EDD", "Large cross-border transfer requires enhanced due diligence", "REVIEW", 50);
    }

    if (input.counterpartyKey && amountMinor >= perTx * RISK_RULES.FIRST_PAYEE_MIN_SHARE_OF_LIMIT) {
      const priorToPayee = sumOne(
        ctx,
        "SELECT COUNT(*) AS v FROM transactions WHERE initiator_user_id = ? AND counterparty_key = ? AND status = 'COMPLETED'",
        user.id,
        input.counterpartyKey,
      );
      if (priorToPayee === 0) hit("FIRST_TIME_PAYEE_HIGH_VALUE", "High-value payment to a first-time payee", "ALLOW", 30);
    }
  }

  // Structuring/smurfing: repeated amounts just under the single-payment
  // threshold, typically spread over several days to stay under the radar.
  if ((isOutflow || type === "CASH_IN") && amountMinor >= perTx * RISK_RULES.STRUCTURING_BAND_LOW && amountMinor <= perTx) {
    const inBand = sumOne(
      ctx,
      `SELECT COUNT(*) AS v FROM transactions WHERE initiator_user_id = ? AND type = ? AND created_at >= ?
       AND amount_minor BETWEEN ? AND ? AND status IN (${inList(LIMIT_COUNTED_STATUSES)})`,
      user.id,
      type,
      sinceIso(RISK_RULES.STRUCTURING_WINDOW_MS),
      Math.ceil(perTx * RISK_RULES.STRUCTURING_BAND_LOW),
      perTx,
    );
    if (inBand >= RISK_RULES.STRUCTURING_PRIOR_COUNT) {
      hit("STRUCTURING", `${inBand + 1} payments just under the single-payment limit within 7 days`, "REVIEW", 70);
    }
  }

  const score = Math.min(100, hits.reduce((s, h) => s + h.score, 0));
  const decision: RiskDecision = hits.some((h) => h.outcome === "BLOCK")
    ? "BLOCK"
    : hits.some((h) => h.outcome === "REVIEW") || score >= RISK_RULES.REVIEW_SCORE_THRESHOLD
      ? "REVIEW"
      : "ALLOW";
  return { decision, score, hits };
}
