import type { Country } from "./types";

/**
 * Liberia — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const LR: Country = {
  code: "LR",
  name: "Liberia",
  flag: "🇱🇷",
  region: "WEST",
  currency: "LRD",
  callingCode: "+231",
  launch: "PLANNED",
  regulator: "Central Bank of Liberia",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "ORANGE_MONEY", label: "Orange Money" },
  ],
  agents: [
    { id: "LR-01", name: "Benki Point Monrovia Centre", location: "Central market, Monrovia" },
    { id: "LR-02", name: "Benki Point Gbarnga", location: "Gbarnga" },
  ],
  billers: [
    { id: "LR-POWER", name: "Prepaid electricity (LEC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "LR-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "LR-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "LR900100", name: "Monrovia Central Market Grocers", category: "Groceries" },
    { code: "LR900200", name: "Gbarnga Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "LR-BANK1", name: "Ecobank Liberia", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "LR-BANK2", name: "LBDI", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 660_000, dailyMinor: 1_700_000, monthlyMinor: 6_600_000, maxBalanceMinor: 6_600_000 },
    TIER_1: { perTransactionMinor: 17_000_000, dailyMinor: 33_000_000, monthlyMinor: 170_000_000, maxBalanceMinor: 66_000_000 },
    TIER_2: { perTransactionMinor: 170_000_000, dailyMinor: 330_000_000, monthlyMinor: 1_700_000_000, maxBalanceMinor: 660_000_000 },
  },
};
