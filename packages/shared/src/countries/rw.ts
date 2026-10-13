import type { Country } from "./types";

/**
 * Rwanda — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const RW: Country = {
  code: "RW",
  name: "Rwanda",
  flag: "🇷🇼",
  region: "EAST",
  currency: "RWF",
  callingCode: "+250",
  launch: "PLANNED",
  regulator: "National Bank of Rwanda",
  languages: { default: "en", offered: ["en", "fr", "sw"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
  ],
  agents: [
    { id: "RW-01", name: "Benki Point Kigali Centre", location: "Central market, Kigali" },
    { id: "RW-02", name: "Benki Point Huye", location: "Huye" },
  ],
  billers: [
    { id: "RW-POWER", name: "Prepaid electricity (REG Cash Power)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "RW-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "RW-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "RW900100", name: "Kigali Central Market Grocers", category: "Groceries" },
    { code: "RW900200", name: "Huye Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "RW-BANK1", name: "Bank of Kigali", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "RW-BANK2", name: "Equity Bank Rwanda", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 48_000, dailyMinor: 120_000, monthlyMinor: 480_000, maxBalanceMinor: 480_000 },
    TIER_1: { perTransactionMinor: 1_200_000, dailyMinor: 2_400_000, monthlyMinor: 12_000_000, maxBalanceMinor: 4_800_000 },
    TIER_2: { perTransactionMinor: 12_000_000, dailyMinor: 24_000_000, monthlyMinor: 120_000_000, maxBalanceMinor: 48_000_000 },
  },
};
