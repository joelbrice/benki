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
// limits by tier" per country. Figures are illustrative and in each country's
// minor units (XOF has none; the others use 2 decimals).
export const TIER_LIMITS: Record<string, Record<KycTier, TierLimits>> = {
  KE: {
    TIER_0: { perTransactionMinor: 200_000, dailyMinor: 500_000, monthlyMinor: 2_000_000, maxBalanceMinor: 1_000_000 },
    TIER_1: { perTransactionMinor: 5_000_000, dailyMinor: 15_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 30_000_000 },
    TIER_2: { perTransactionMinor: 50_000_000, dailyMinor: 100_000_000, monthlyMinor: 500_000_000, maxBalanceMinor: 300_000_000 },
  },
  GH: {
    TIER_0: { perTransactionMinor: 15_000, dailyMinor: 50_000, monthlyMinor: 150_000, maxBalanceMinor: 100_000 },
    TIER_1: { perTransactionMinor: 300_000, dailyMinor: 1_000_000, monthlyMinor: 3_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 3_000_000, dailyMinor: 10_000_000, monthlyMinor: 30_000_000, maxBalanceMinor: 20_000_000 },
  },
  NG: {
    TIER_0: { perTransactionMinor: 2_000_000, dailyMinor: 5_000_000, monthlyMinor: 30_000_000, maxBalanceMinor: 30_000_000 },
    TIER_1: { perTransactionMinor: 50_000_000, dailyMinor: 100_000_000, monthlyMinor: 1_000_000_000, maxBalanceMinor: 300_000_000 },
    TIER_2: { perTransactionMinor: 500_000_000, dailyMinor: 1_000_000_000, monthlyMinor: 10_000_000_000, maxBalanceMinor: 5_000_000_000 },
  },
  TZ: {
    TIER_0: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 30_000_000 },
    TIER_1: { perTransactionMinor: 100_000_000, dailyMinor: 300_000_000, monthlyMinor: 1_000_000_000, maxBalanceMinor: 500_000_000 },
    TIER_2: { perTransactionMinor: 1_000_000_000, dailyMinor: 2_000_000_000, monthlyMinor: 10_000_000_000, maxBalanceMinor: 5_000_000_000 },
  },
  SN: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};

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
} as const satisfies Record<string, KycTier>;

const TIER_RANK: Record<KycTier, number> = { TIER_0: 0, TIER_1: 1, TIER_2: 2 };

export function tierAtLeast(tier: KycTier, required: KycTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[required];
}
