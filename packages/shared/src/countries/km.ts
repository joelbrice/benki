import type { Country } from "./types";

/**
 * Comoros — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const KM: Country = {
  code: "KM",
  name: "Comoros",
  flag: "🇰🇲",
  region: "EAST",
  currency: "KMF",
  callingCode: "+269",
  launch: "PLANNED",
  regulator: "Banque Centrale des Comores",
  languages: { default: "fr", offered: ["fr", "ar"] },
  mobileMoneyProviders: [
    { id: "HURI_MONEY", label: "Huri Money" },
    { id: "MVOLA", label: "MVola" },
  ],
  networks: [
    { id: "COMORES_TELECOM", label: "Comores Telecom" },
    { id: "TELMA_KM", label: "Telma" },
  ],
  agents: [
    { id: "KM-01", name: "Benki Point Moroni Centre", location: "Central market, Moroni" },
    { id: "KM-02", name: "Benki Point Mutsamudu", location: "Mutsamudu" },
  ],
  billers: [
    { id: "KM-POWER", name: "Prepaid electricity (SONELEC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "KM-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "KM-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "KM900100", name: "Moroni Central Market Grocers", category: "Groceries" },
    { code: "KM900200", name: "Pharmacie Mutsamudu", category: "Pharmacy" },
  ],
  banks: [
    { id: "KM-BANK1", name: "BIC Comores", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "KM-BANK2", name: "Exim Bank Comores", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 15_000, dailyMinor: 38_000, monthlyMinor: 150_000, maxBalanceMinor: 150_000 },
    TIER_1: { perTransactionMinor: 380_000, dailyMinor: 750_000, monthlyMinor: 3_800_000, maxBalanceMinor: 1_500_000 },
    TIER_2: { perTransactionMinor: 3_800_000, dailyMinor: 7_500_000, monthlyMinor: 38_000_000, maxBalanceMinor: 15_000_000 },
  },
};
