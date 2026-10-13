import type { Country } from "./types";

/**
 * Benin — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const BJ: Country = {
  code: "BJ",
  name: "Benin",
  flag: "🇧🇯",
  region: "WEST",
  currency: "XOF",
  callingCode: "+229",
  zone: "WAEMU",
  launch: "PLANNED",
  regulator: "BCEAO / Commission Bancaire de l'UMOA",
  languages: { default: "fr", offered: ["fr", "yo", "en"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "MOOV_MONEY", label: "Moov Money" },
  ],
  agents: [
    { id: "BJ-01", name: "Benki Point Cotonou Centre", location: "Central market, Cotonou" },
    { id: "BJ-02", name: "Benki Point Parakou", location: "Parakou" },
  ],
  billers: [
    { id: "BJ-POWER", name: "Prepaid electricity (SBEE)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "BJ-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "BJ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "BJ900100", name: "Cotonou Central Market Grocers", category: "Groceries" },
    { code: "BJ900200", name: "Pharmacie Parakou", category: "Pharmacy" },
  ],
  banks: [
    { id: "BJ-BANK1", name: "Ecobank Bénin", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
    { id: "BJ-BANK2", name: "Bank of Africa Bénin", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
