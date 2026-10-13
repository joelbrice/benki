import type { Country } from "./types";

/**
 * Sierra Leone — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const SL: Country = {
  code: "SL",
  name: "Sierra Leone",
  flag: "🇸🇱",
  region: "WEST",
  currency: "SLE",
  callingCode: "+232",
  launch: "PLANNED",
  regulator: "Bank of Sierra Leone",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "AFRICELL_MONEY", label: "Africell Money" },
  ],
  agents: [
    { id: "SL-01", name: "Benki Point Freetown Centre", location: "Central market, Freetown" },
    { id: "SL-02", name: "Benki Point Bo", location: "Bo" },
  ],
  billers: [
    { id: "SL-POWER", name: "Prepaid electricity (EDSA)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "SL-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "SL-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "SL900100", name: "Freetown Central Market Grocers", category: "Groceries" },
    { code: "SL900200", name: "Bo Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "SL-BANK1", name: "Rokel Commercial Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "SL-BANK2", name: "Ecobank Sierra Leone", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 76_000, dailyMinor: 190_000, monthlyMinor: 760_000, maxBalanceMinor: 760_000 },
    TIER_1: { perTransactionMinor: 1_900_000, dailyMinor: 3_800_000, monthlyMinor: 19_000_000, maxBalanceMinor: 7_600_000 },
    TIER_2: { perTransactionMinor: 19_000_000, dailyMinor: 38_000_000, monthlyMinor: 190_000_000, maxBalanceMinor: 76_000_000 },
  },
};
