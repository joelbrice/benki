import type { Country } from "./types";

/**
 * Guinea — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const GN: Country = {
  code: "GN",
  name: "Guinea",
  flag: "🇬🇳",
  region: "WEST",
  currency: "GNF",
  callingCode: "+224",
  launch: "PLANNED",
  regulator: "Banque Centrale de la République de Guinée",
  languages: { default: "fr", offered: ["fr", "en"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
  ],
  agents: [
    { id: "GN-01", name: "Benki Point Conakry Centre", location: "Central market, Conakry" },
    { id: "GN-02", name: "Benki Point Kankan", location: "Kankan" },
  ],
  billers: [
    { id: "GN-POWER", name: "Prepaid electricity (EDG)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "GN-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "GN-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "GN900100", name: "Conakry Central Market Grocers", category: "Groceries" },
    { code: "GN900200", name: "Pharmacie Kankan", category: "Pharmacy" },
  ],
  banks: [
    { id: "GN-BANK1", name: "Ecobank Guinée", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "GN-BANK2", name: "UBA Guinée", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 290_000, dailyMinor: 720_000, monthlyMinor: 2_900_000, maxBalanceMinor: 2_900_000 },
    TIER_1: { perTransactionMinor: 7_200_000, dailyMinor: 14_000_000, monthlyMinor: 72_000_000, maxBalanceMinor: 29_000_000 },
    TIER_2: { perTransactionMinor: 72_000_000, dailyMinor: 140_000_000, monthlyMinor: 720_000_000, maxBalanceMinor: 290_000_000 },
  },
};
