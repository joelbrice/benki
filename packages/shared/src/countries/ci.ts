import type { Country } from "./types";

/**
 * Côte d'Ivoire — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const CI: Country = {
  code: "CI",
  name: "Côte d'Ivoire",
  flag: "🇨🇮",
  region: "WEST",
  currency: "XOF",
  callingCode: "+225",
  zone: "WAEMU",
  launch: "PLANNED",
  regulator: "BCEAO / Commission Bancaire de l'UMOA",
  languages: { default: "fr", offered: ["fr", "en"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "MOOV_MONEY", label: "Moov Money" },
    { id: "WAVE", label: "Wave" },
  ],
  agents: [
    { id: "CI-01", name: "Benki Point Abidjan Centre", location: "Central market, Abidjan" },
    { id: "CI-02", name: "Benki Point Bouaké", location: "Bouaké" },
  ],
  billers: [
    { id: "CI-POWER", name: "Prepaid electricity (CIE)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "CI-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "CI-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "CI900100", name: "Abidjan Central Market Grocers", category: "Groceries" },
    { code: "CI900200", name: "Pharmacie Bouaké", category: "Pharmacy" },
  ],
  banks: [
    { id: "CI-BANK1", name: "Société Générale Côte d'Ivoire", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
    { id: "CI-BANK2", name: "NSIA Banque", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
