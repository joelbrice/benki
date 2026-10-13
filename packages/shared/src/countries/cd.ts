import type { Country } from "./types";

/**
 * DR Congo — live.
 */
export const CD: Country = {
  code: "CD",
  name: "DR Congo",
  flag: "🇨🇩",
  region: "CENTRAL",
  currency: "CDF",
  callingCode: "+243",
  launch: "LIVE",
  regulator: "Banque Centrale du Congo",
  languages: { default: "fr", offered: ["fr", "ln", "sw"] },
  mobileMoneyProviders: [
    { id: "MPESA", label: "M-Pesa (Vodacom)" },
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
  ],
  agents: [
    { id: "CD-01", name: "Ets. Mbuyi", location: "Marché Gambela, Kinshasa" },
    { id: "CD-02", name: "Cabine Lubumbashi Centre", location: "Lubumbashi" },
    { id: "CD-03", name: "Boutique Neema", location: "Goma" },
  ],
  billers: [
    { id: "CD-POWER", name: "Prepaid electricity (SNEL)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "CD-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "CD170100", name: "Pagne Wax Matonge", category: "Textiles" },
    { code: "CD170200", name: "Malewa ya Mama Kiese", category: "Food" },
  ],
  banks: [
    { id: "CD-RAWBANK", name: "Rawbank", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number" },
    { id: "CD-EQUITYBCDC", name: "Equity BCDC", accountNumberPattern: "^[0-9A-Z]{10,24}$", accountNumberHint: "Account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 500_000, dailyMinor: 1_400_000, monthlyMinor: 5_600_000, maxBalanceMinor: 2_800_000 },
    TIER_1: { perTransactionMinor: 2_800_000, dailyMinor: 5_600_000, monthlyMinor: 28_000_000, maxBalanceMinor: 11_200_000 },
    TIER_2: { perTransactionMinor: 28_000_000, dailyMinor: 56_000_000, monthlyMinor: 280_000_000, maxBalanceMinor: 112_000_000 },
  },
};
