import type { Country } from "./types";

/**
 * Angola — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const AO: Country = {
  code: "AO",
  name: "Angola",
  flag: "🇦🇴",
  region: "CENTRAL",
  currency: "AOA",
  callingCode: "+244",
  launch: "PLANNED",
  regulator: "Banco Nacional de Angola",
  languages: { default: "pt", offered: ["pt", "en"] },
  mobileMoneyProviders: [
    { id: "UNITEL_MONEY", label: "Unitel Money" },
    { id: "AFRIMONEY", label: "Afrimoney" },
  ],
  agents: [
    { id: "AO-01", name: "Benki Point Luanda Centre", location: "Central market, Luanda" },
    { id: "AO-02", name: "Benki Point Huambo", location: "Huambo" },
  ],
  billers: [
    { id: "AO-POWER", name: "Prepaid electricity (ENDE)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "AO-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "AO-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "AO900100", name: "Luanda Central Market Grocers", category: "Groceries" },
    { code: "AO900200", name: "Farmácia Huambo", category: "Pharmacy" },
  ],
  banks: [
    { id: "AO-BANK1", name: "Banco BAI", accountNumberPattern: "^[0-9]{9,15}$", accountNumberHint: "9–15 digit account number" },
    { id: "AO-BANK2", name: "Banco BFA", accountNumberPattern: "^[0-9]{9,15}$", accountNumberHint: "9–15 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 3_100_000, dailyMinor: 7_700_000, monthlyMinor: 31_000_000, maxBalanceMinor: 31_000_000 },
    TIER_1: { perTransactionMinor: 77_000_000, dailyMinor: 150_000_000, monthlyMinor: 770_000_000, maxBalanceMinor: 310_000_000 },
    TIER_2: { perTransactionMinor: 770_000_000, dailyMinor: 1_500_000_000, monthlyMinor: 7_700_000_000, maxBalanceMinor: 3_100_000_000 },
  },
};
