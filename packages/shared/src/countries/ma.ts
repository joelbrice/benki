import type { Country } from "./types";

/**
 * Morocco — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const MA: Country = {
  code: "MA",
  name: "Morocco",
  flag: "🇲🇦",
  region: "NORTH",
  currency: "MAD",
  callingCode: "+212",
  launch: "PLANNED",
  regulator: "Bank Al-Maghrib",
  languages: { default: "ar", offered: ["ar", "fr"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "INWI_MONEY", label: "inwi money" },
  ],
  networks: [
    { id: "MAROC_TELECOM", label: "Maroc Telecom" },
    { id: "ORANGE_MA", label: "Orange" },
    { id: "INWI", label: "inwi" },
  ],
  agents: [
    { id: "MA-01", name: "Benki Point Casablanca Centre", location: "Central market, Casablanca" },
    { id: "MA-02", name: "Benki Point Marrakech", location: "Marrakech" },
  ],
  billers: [
    { id: "MA-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "MA-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "MA-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "MA900100", name: "Casablanca Central Market Grocers", category: "Groceries" },
    { code: "MA900200", name: "Pharmacie Marrakech", category: "Pharmacy" },
  ],
  banks: [
    { id: "MA-BANK1", name: "Attijariwafa bank", accountNumberPattern: "^[0-9]{24}$", accountNumberHint: "Account number (RIB)" },
    { id: "MA-BANK2", name: "Banque Populaire", accountNumberPattern: "^[0-9]{24}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 31_000, dailyMinor: 78_000, monthlyMinor: 310_000, maxBalanceMinor: 310_000 },
    TIER_1: { perTransactionMinor: 780_000, dailyMinor: 1_600_000, monthlyMinor: 7_800_000, maxBalanceMinor: 3_100_000 },
    TIER_2: { perTransactionMinor: 7_800_000, dailyMinor: 16_000_000, monthlyMinor: 78_000_000, maxBalanceMinor: 31_000_000 },
  },
};
