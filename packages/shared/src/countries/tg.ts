import type { Country } from "./types";

/**
 * Togo — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const TG: Country = {
  code: "TG",
  name: "Togo",
  flag: "🇹🇬",
  region: "WEST",
  currency: "XOF",
  callingCode: "+228",
  zone: "WAEMU",
  launch: "PLANNED",
  regulator: "BCEAO / Commission Bancaire de l'UMOA",
  languages: { default: "fr", offered: ["fr", "en"] },
  mobileMoneyProviders: [
    { id: "TMONEY", label: "TMoney" },
    { id: "MOOV_MONEY", label: "Flooz (Moov Africa)" },
  ],
  agents: [
    { id: "TG-01", name: "Benki Point Lomé Centre", location: "Central market, Lomé" },
    { id: "TG-02", name: "Benki Point Kara", location: "Kara" },
  ],
  billers: [
    { id: "TG-POWER", name: "Prepaid electricity (CEET)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "TG-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "TG-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "TG900100", name: "Lomé Central Market Grocers", category: "Groceries" },
    { code: "TG900200", name: "Pharmacie Kara", category: "Pharmacy" },
  ],
  banks: [
    { id: "TG-BANK1", name: "Orabank Togo", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
    { id: "TG-BANK2", name: "Ecobank Togo", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
