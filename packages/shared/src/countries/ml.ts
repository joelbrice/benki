import type { Country } from "./types";

/**
 * Mali — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const ML: Country = {
  code: "ML",
  name: "Mali",
  flag: "🇲🇱",
  region: "WEST",
  currency: "XOF",
  callingCode: "+223",
  zone: "WAEMU",
  launch: "PLANNED",
  regulator: "BCEAO / Commission Bancaire de l'UMOA",
  languages: { default: "fr", offered: ["fr", "en"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "MOOV_MONEY", label: "Moov Money" },
    { id: "WAVE", label: "Wave" },
  ],
  agents: [
    { id: "ML-01", name: "Benki Point Bamako Centre", location: "Central market, Bamako" },
    { id: "ML-02", name: "Benki Point Sikasso", location: "Sikasso" },
  ],
  billers: [
    { id: "ML-POWER", name: "Prepaid electricity (EDM-SA)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "ML-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "ML-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "ML900100", name: "Bamako Central Market Grocers", category: "Groceries" },
    { code: "ML900200", name: "Pharmacie Sikasso", category: "Pharmacy" },
  ],
  banks: [
    { id: "ML-BANK1", name: "BDM-SA", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
    { id: "ML-BANK2", name: "Ecobank Mali", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
