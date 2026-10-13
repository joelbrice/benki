import type { Country } from "./types";

/**
 * Algeria — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const DZ: Country = {
  code: "DZ",
  name: "Algeria",
  flag: "🇩🇿",
  region: "NORTH",
  currency: "DZD",
  callingCode: "+213",
  launch: "PLANNED",
  regulator: "Banque d'Algérie",
  languages: { default: "ar", offered: ["ar", "fr"] },
  mobileMoneyProviders: [],
  networks: [
    { id: "MOBILIS", label: "Mobilis" },
    { id: "DJEZZY", label: "Djezzy" },
    { id: "OOREDOO_DZ", label: "Ooredoo" },
  ],
  agents: [
    { id: "DZ-01", name: "Benki Point Algiers Centre", location: "Central market, Algiers" },
    { id: "DZ-02", name: "Benki Point Oran", location: "Oran" },
  ],
  billers: [
    { id: "DZ-POWER", name: "Prepaid electricity (Sonelgaz)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "DZ-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "DZ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "DZ900100", name: "Algiers Central Market Grocers", category: "Groceries" },
    { code: "DZ900200", name: "Pharmacie Oran", category: "Pharmacy" },
  ],
  banks: [
    { id: "DZ-BANK1", name: "BNA", accountNumberPattern: "^[0-9]{20}$", accountNumberHint: "Account number (RIB)" },
    { id: "DZ-BANK2", name: "CPA", accountNumberPattern: "^[0-9]{20}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 440_000, dailyMinor: 1_100_000, monthlyMinor: 4_400_000, maxBalanceMinor: 4_400_000 },
    TIER_1: { perTransactionMinor: 11_000_000, dailyMinor: 22_000_000, monthlyMinor: 110_000_000, maxBalanceMinor: 44_000_000 },
    TIER_2: { perTransactionMinor: 110_000_000, dailyMinor: 220_000_000, monthlyMinor: 1_100_000_000, maxBalanceMinor: 440_000_000 },
  },
};
