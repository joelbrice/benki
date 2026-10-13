import type { Country } from "./types";

/**
 * Tunisia — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const TN: Country = {
  code: "TN",
  name: "Tunisia",
  flag: "🇹🇳",
  region: "NORTH",
  currency: "TND",
  callingCode: "+216",
  launch: "PLANNED",
  regulator: "Banque Centrale de Tunisie",
  languages: { default: "ar", offered: ["ar", "fr"] },
  mobileMoneyProviders: [
    { id: "D17", label: "D17 (La Poste)" },
  ],
  networks: [
    { id: "TUNISIE_TELECOM", label: "Tunisie Telecom" },
    { id: "OOREDOO_TN", label: "Ooredoo" },
    { id: "ORANGE_TN", label: "Orange" },
  ],
  agents: [
    { id: "TN-01", name: "Benki Point Tunis Centre", location: "Central market, Tunis" },
    { id: "TN-02", name: "Benki Point Sfax", location: "Sfax" },
  ],
  billers: [
    { id: "TN-POWER", name: "Prepaid electricity (STEG)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "TN-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "TN-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "TN900100", name: "Tunis Central Market Grocers", category: "Groceries" },
    { code: "TN900200", name: "Pharmacie Sfax", category: "Pharmacy" },
  ],
  banks: [
    { id: "TN-BANK1", name: "BIAT", accountNumberPattern: "^[0-9]{20}$", accountNumberHint: "Account number (RIB)" },
    { id: "TN-BANK2", name: "Banque de Tunisie", accountNumberPattern: "^[0-9]{20}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 100_000, dailyMinor: 260_000, monthlyMinor: 1_000_000, maxBalanceMinor: 1_000_000 },
    TIER_1: { perTransactionMinor: 2_600_000, dailyMinor: 5_200_000, monthlyMinor: 26_000_000, maxBalanceMinor: 10_000_000 },
    TIER_2: { perTransactionMinor: 26_000_000, dailyMinor: 52_000_000, monthlyMinor: 260_000_000, maxBalanceMinor: 100_000_000 },
  },
};
