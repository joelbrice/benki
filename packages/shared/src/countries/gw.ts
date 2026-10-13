import type { Country } from "./types";

/**
 * Guinea-Bissau — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const GW: Country = {
  code: "GW",
  name: "Guinea-Bissau",
  flag: "🇬🇼",
  region: "WEST",
  currency: "XOF",
  callingCode: "+245",
  zone: "WAEMU",
  launch: "PLANNED",
  regulator: "BCEAO / Commission Bancaire de l'UMOA",
  languages: { default: "pt", offered: ["pt", "fr"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
  ],
  agents: [
    { id: "GW-01", name: "Benki Point Bissau Centre", location: "Central market, Bissau" },
    { id: "GW-02", name: "Benki Point Bafatá", location: "Bafatá" },
  ],
  billers: [
    { id: "GW-POWER", name: "Prepaid electricity (EAGB)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "GW-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "GW-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "GW900100", name: "Bissau Central Market Grocers", category: "Groceries" },
    { code: "GW900200", name: "Farmácia Bafatá", category: "Pharmacy" },
  ],
  banks: [
    { id: "GW-BANK1", name: "Ecobank Guiné-Bissau", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
    { id: "GW-BANK2", name: "Banco da África Ocidental", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
