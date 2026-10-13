import type { Country } from "./types";

/**
 * Libya — Planned. Partners, agents and limits are placeholders until launch preparation. Conflict-affected jurisdiction: enhanced due diligence on every corridor.
 */
export const LY: Country = {
  code: "LY",
  name: "Libya",
  flag: "🇱🇾",
  region: "NORTH",
  currency: "LYD",
  callingCode: "+218",
  launch: "PLANNED",
  regulator: "Central Bank of Libya",
  languages: { default: "ar", offered: ["ar", "en"] },
  enhancedDueDiligence: true,
  mobileMoneyProviders: [],
  networks: [
    { id: "LIBYANA", label: "Libyana" },
    { id: "ALMADAR", label: "Al-Madar" },
  ],
  agents: [
    { id: "LY-01", name: "Benki Point Tripoli Centre", location: "Central market, Tripoli" },
    { id: "LY-02", name: "Benki Point Benghazi", location: "Benghazi" },
  ],
  billers: [
    { id: "LY-POWER", name: "Prepaid electricity (GECOL)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "LY-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "LY-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "LY900100", name: "Tripoli Central Market Grocers", category: "Groceries" },
    { code: "LY900200", name: "Pharmacie Benghazi", category: "Pharmacy" },
  ],
  banks: [
    { id: "LY-BANK1", name: "Jumhouria Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "LY-BANK2", name: "Bank of Commerce & Development", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 180_000, dailyMinor: 450_000, monthlyMinor: 1_800_000, maxBalanceMinor: 1_800_000 },
    TIER_1: { perTransactionMinor: 4_500_000, dailyMinor: 9_100_000, monthlyMinor: 45_000_000, maxBalanceMinor: 18_000_000 },
    TIER_2: { perTransactionMinor: 45_000_000, dailyMinor: 91_000_000, monthlyMinor: 450_000_000, maxBalanceMinor: 180_000_000 },
  },
};
