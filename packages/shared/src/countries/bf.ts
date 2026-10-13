import type { Country } from "./types";

/**
 * Burkina Faso — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const BF: Country = {
  code: "BF",
  name: "Burkina Faso",
  flag: "🇧🇫",
  region: "WEST",
  currency: "XOF",
  callingCode: "+226",
  zone: "WAEMU",
  launch: "PLANNED",
  regulator: "BCEAO / Commission Bancaire de l'UMOA",
  languages: { default: "fr", offered: ["fr", "en"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "MOOV_MONEY", label: "Moov Money" },
  ],
  agents: [
    { id: "BF-01", name: "Benki Point Ouagadougou Centre", location: "Central market, Ouagadougou" },
    { id: "BF-02", name: "Benki Point Bobo-Dioulasso", location: "Bobo-Dioulasso" },
  ],
  billers: [
    { id: "BF-POWER", name: "Prepaid electricity (SONABEL)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "BF-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "BF-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "BF900100", name: "Ouagadougou Central Market Grocers", category: "Groceries" },
    { code: "BF900200", name: "Pharmacie Bobo-Dioulasso", category: "Pharmacy" },
  ],
  banks: [
    { id: "BF-BANK1", name: "Coris Bank International", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
    { id: "BF-BANK2", name: "Ecobank Burkina", accountNumberPattern: "^[0-9A-Z]{24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
