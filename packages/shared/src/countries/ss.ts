import type { Country } from "./types";

/**
 * South Sudan — Planned. Partners, agents and limits are placeholders until launch preparation. Conflict-affected jurisdiction: enhanced due diligence on every corridor.
 */
export const SS: Country = {
  code: "SS",
  name: "South Sudan",
  flag: "🇸🇸",
  region: "EAST",
  currency: "SSP",
  callingCode: "+211",
  launch: "PLANNED",
  regulator: "Bank of South Sudan",
  languages: { default: "en", offered: ["en", "ar"] },
  enhancedDueDiligence: true,
  mobileMoneyProviders: [
    { id: "MGURUSH", label: "m-Gurush" },
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
  ],
  networks: [
    { id: "MTN_SS", label: "MTN" },
    { id: "ZAIN_SS", label: "Zain" },
  ],
  agents: [
    { id: "SS-01", name: "Benki Point Juba Centre", location: "Central market, Juba" },
    { id: "SS-02", name: "Benki Point Wau", location: "Wau" },
  ],
  billers: [
    { id: "SS-POWER", name: "Prepaid electricity (JEDCO)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "SS-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "SS-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "SS900100", name: "Juba Central Market Grocers", category: "Groceries" },
    { code: "SS900200", name: "Wau Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "SS-BANK1", name: "Ivory Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "SS-BANK2", name: "KCB South Sudan", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 15_000_000, dailyMinor: 38_000_000, monthlyMinor: 150_000_000, maxBalanceMinor: 150_000_000 },
    TIER_1: { perTransactionMinor: 380_000_000, dailyMinor: 750_000_000, monthlyMinor: 3_800_000_000, maxBalanceMinor: 1_500_000_000 },
    TIER_2: { perTransactionMinor: 3_800_000_000, dailyMinor: 7_500_000_000, monthlyMinor: 38_000_000_000, maxBalanceMinor: 15_000_000_000 },
  },
};
