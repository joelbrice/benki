import type { Country } from "./types";

/**
 * Uganda — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const UG: Country = {
  code: "UG",
  name: "Uganda",
  flag: "🇺🇬",
  region: "EAST",
  currency: "UGX",
  callingCode: "+256",
  launch: "PLANNED",
  regulator: "Bank of Uganda",
  languages: { default: "en", offered: ["en", "sw"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
  ],
  agents: [
    { id: "UG-01", name: "Benki Point Kampala Centre", location: "Central market, Kampala" },
    { id: "UG-02", name: "Benki Point Gulu", location: "Gulu" },
  ],
  billers: [
    { id: "UG-POWER", name: "Prepaid electricity (UEDCL Yaka)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "UG-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "UG-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "UG900100", name: "Kampala Central Market Grocers", category: "Groceries" },
    { code: "UG900200", name: "Gulu Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "UG-BANK1", name: "Stanbic Bank Uganda", accountNumberPattern: "^[0-9]{10,14}$", accountNumberHint: "10–14 digit account number" },
    { id: "UG-BANK2", name: "Centenary Bank", accountNumberPattern: "^[0-9]{10,14}$", accountNumberHint: "10–14 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 120_000, dailyMinor: 300_000, monthlyMinor: 1_200_000, maxBalanceMinor: 1_200_000 },
    TIER_1: { perTransactionMinor: 3_000_000, dailyMinor: 6_100_000, monthlyMinor: 30_000_000, maxBalanceMinor: 12_000_000 },
    TIER_2: { perTransactionMinor: 30_000_000, dailyMinor: 61_000_000, monthlyMinor: 300_000_000, maxBalanceMinor: 120_000_000 },
  },
};
