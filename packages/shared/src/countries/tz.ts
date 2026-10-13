import type { Country } from "./types";

/**
 * Tanzania — live.
 */
export const TZ: Country = {
  code: "TZ",
  name: "Tanzania",
  flag: "🇹🇿",
  region: "EAST",
  currency: "TZS",
  callingCode: "+255",
  launch: "LIVE",
  regulator: "Bank of Tanzania",
  languages: { default: "sw", offered: ["sw", "en"] },
  mobileMoneyProviders: [
    { id: "MPESA", label: "M-Pesa (Vodacom)" },
    { id: "TIGOPESA", label: "Tigo Pesa" },
  ],
  agents: [
    { id: "TZ-01", name: "Neema Duka", location: "Dar es Salaam" },
    { id: "TZ-02", name: "Juma's Kiosk", location: "Arusha" },
  ],
  billers: [
    { id: "TZ-POWER", name: "Prepaid electricity (LUKU)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "TZ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "TZ800100", name: "Kariakoo Spices", category: "Groceries" },
    { code: "TZ800200", name: "Bahari Fish Market", category: "Food" },
  ],
  banks: [
    { id: "TZ-CRDB", name: "CRDB Bank", accountNumberPattern: "^[0-9]{10,15}$", accountNumberHint: "10–15 digit account number" },
    { id: "TZ-NMB", name: "NMB Bank", accountNumberPattern: "^[0-9]{10,15}$", accountNumberHint: "10–15 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 30_000_000 },
    TIER_1: { perTransactionMinor: 100_000_000, dailyMinor: 300_000_000, monthlyMinor: 1_000_000_000, maxBalanceMinor: 500_000_000 },
    TIER_2: { perTransactionMinor: 1_000_000_000, dailyMinor: 2_000_000_000, monthlyMinor: 10_000_000_000, maxBalanceMinor: 5_000_000_000 },
  },
};
