import { AFRICAN_COUNTRIES } from "./countries";

export type KycTier = "TIER_0" | "TIER_1" | "TIER_2";

export interface TierLimits {
  /** Largest single outgoing payment. */
  perTransactionMinor: number;
  /** Rolling 24h cumulative outgoing. */
  dailyMinor: number;
  /** Rolling 30-day cumulative outgoing. */
  monthlyMinor: number;
  /** Maximum total holdings (wallet + savings), the classic e-money balance cap. */
  maxBalanceMinor: number;
}

// docs/COUNTRY_COMPLIANCE_MATRIX.md requires "maximum balance and transaction
// limits by tier" per country. Each country module sets its own, in minor
// units of its currency; figures are illustrative.
export const TIER_LIMITS: Record<string, Record<KycTier, TierLimits>> = Object.fromEntries(
  AFRICAN_COUNTRIES.map((c) => [c.code, c.limits]),
);

export function tierLimits(countryCode: string, tier: KycTier): TierLimits {
  const country = TIER_LIMITS[countryCode];
  if (!country) throw new Error(`No limits configured for ${countryCode}`);
  return country[tier];
}

/** Services gated by KYC tier (docs/KYC_AML_POLICY_AND_RISK.md: Tier 0 has restricted services). */
export const MIN_TIER_FOR_SERVICE = {
  CROSS_BORDER: "TIER_1",
  MOBILE_MONEY_PAYOUT: "TIER_0",
  CASH_OUT: "TIER_0",
  MERCHANT_PAYMENT: "TIER_0",
  BILL_PAYMENT: "TIER_0",
  AIRTIME: "TIER_0",
  P2P: "TIER_0",
  SAVINGS: "TIER_1",
  BANK_TRANSFER: "TIER_1",
  POCKETS: "TIER_1",
  GROUPS: "TIER_1",
  LOANS: "TIER_1",
} as const satisfies Record<string, KycTier>;

/**
 * Nano-loan product. Flat fee for a fixed term, fully disclosed (with the
 * annualized equivalent) before the customer accepts. Eligibility and the
 * maximum principal are computed server-side from KYC tier and history.
 */
export const LOAN_PRODUCT = {
  feeBps: 500,
  termDays: 30,
  /** Max principal as a share of the tier's single-payment limit. */
  maxShareOfPerTransactionLimit: 0.5,
  /** Max principal as a share of the last 90 days' completed inflows. */
  maxShareOfRecentInflows: 0.3,
  minCompletedInflows: 3,
  minPrincipalMajor: 10,
} as const;

export function loanFeeMinor(principalMinor: number): number {
  return Math.ceil((principalMinor * LOAN_PRODUCT.feeBps) / 10_000);
}

/** Simple annualized rate of the flat fee, for disclosure. */
export function loanAprPercent(): number {
  return Math.round((LOAN_PRODUCT.feeBps / 100) * (365 / LOAN_PRODUCT.termDays) * 10) / 10;
}

export const MAX_GROUP_MEMBERS = 30;

const TIER_RANK: Record<KycTier, number> = { TIER_0: 0, TIER_1: 1, TIER_2: 2 };

export function tierAtLeast(tier: KycTier, required: KycTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[required];
}
