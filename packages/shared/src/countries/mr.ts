import type { Country } from "./types";

/**
 * Mauritania — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const MR: Country = {
  code: "MR",
  name: "Mauritania",
  flag: "🇲🇷",
  region: "WEST",
  currency: "MRU",
  callingCode: "+222",
  launch: "PLANNED",
  regulator: "Banque Centrale de Mauritanie",
  languages: { default: "ar", offered: ["ar", "fr", "wo"] },
  mobileMoneyProviders: [
    { id: "BANKILY", label: "Bankily" },
    { id: "MASRVI", label: "Masrvi" },
    { id: "SEDAD", label: "Sedad" },
  ],
  networks: [
    { id: "MAURITEL", label: "Mauritel" },
    { id: "MATTEL", label: "Mattel" },
    { id: "CHINGUITEL", label: "Chinguitel" },
  ],
  agents: [
    { id: "MR-01", name: "Benki Point Nouakchott Centre", location: "Central market, Nouakchott" },
    { id: "MR-02", name: "Benki Point Nouadhibou", location: "Nouadhibou" },
  ],
  billers: [
    { id: "MR-POWER", name: "Prepaid electricity (SOMELEC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "MR-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "MR-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "MR900100", name: "Nouakchott Central Market Grocers", category: "Groceries" },
    { code: "MR900200", name: "Pharmacie Nouadhibou", category: "Pharmacy" },
  ],
  banks: [
    { id: "MR-BANK1", name: "BMCI", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "MR-BANK2", name: "Banque Populaire de Mauritanie", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 130_000, dailyMinor: 330_000, monthlyMinor: 1_300_000, maxBalanceMinor: 1_300_000 },
    TIER_1: { perTransactionMinor: 3_300_000, dailyMinor: 6_600_000, monthlyMinor: 33_000_000, maxBalanceMinor: 13_000_000 },
    TIER_2: { perTransactionMinor: 33_000_000, dailyMinor: 66_000_000, monthlyMinor: 330_000_000, maxBalanceMinor: 130_000_000 },
  },
};
