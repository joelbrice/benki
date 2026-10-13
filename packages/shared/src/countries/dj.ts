import type { Country } from "./types";

/**
 * Djibouti — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const DJ: Country = {
  code: "DJ",
  name: "Djibouti",
  flag: "🇩🇯",
  region: "EAST",
  currency: "DJF",
  callingCode: "+253",
  launch: "PLANNED",
  regulator: "Banque Centrale de Djibouti",
  languages: { default: "fr", offered: ["fr", "ar"] },
  mobileMoneyProviders: [
    { id: "DMONEY", label: "D-Money" },
    { id: "WAAFI", label: "Waafi" },
  ],
  networks: [
    { id: "DJIBOUTI_TELECOM", label: "Djibouti Telecom" },
  ],
  agents: [
    { id: "DJ-01", name: "Benki Point Djibouti Centre", location: "Central market, Djibouti" },
    { id: "DJ-02", name: "Benki Point Ali Sabieh", location: "Ali Sabieh" },
  ],
  billers: [
    { id: "DJ-POWER", name: "Prepaid electricity (EDD)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "DJ-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "DJ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "DJ900100", name: "Djibouti Central Market Grocers", category: "Groceries" },
    { code: "DJ900200", name: "Pharmacie Ali Sabieh", category: "Pharmacy" },
  ],
  banks: [
    { id: "DJ-BANK1", name: "BCIMR", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "DJ-BANK2", name: "Salaam African Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 5900, dailyMinor: 15_000, monthlyMinor: 59_000, maxBalanceMinor: 59_000 },
    TIER_1: { perTransactionMinor: 150_000, dailyMinor: 300_000, monthlyMinor: 1_500_000, maxBalanceMinor: 590_000 },
    TIER_2: { perTransactionMinor: 1_500_000, dailyMinor: 3_000_000, monthlyMinor: 15_000_000, maxBalanceMinor: 5_900_000 },
  },
};
