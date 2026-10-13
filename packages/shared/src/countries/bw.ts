import type { Country } from "./types";

/**
 * Botswana — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const BW: Country = {
  code: "BW",
  name: "Botswana",
  flag: "🇧🇼",
  region: "SOUTHERN",
  currency: "BWP",
  callingCode: "+267",
  launch: "PLANNED",
  regulator: "Bank of Botswana",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "ORANGE_MONEY", label: "Orange Money" },
    { id: "MYZAKA", label: "MyZaka (Mascom)" },
    { id: "SMEGA", label: "Smega (BTC)" },
  ],
  networks: [
    { id: "ORANGE_BW", label: "Orange" },
    { id: "MASCOM", label: "Mascom" },
    { id: "BTC", label: "BTC" },
  ],
  agents: [
    { id: "BW-01", name: "Benki Point Gaborone Centre", location: "Central market, Gaborone" },
    { id: "BW-02", name: "Benki Point Francistown", location: "Francistown" },
  ],
  billers: [
    { id: "BW-POWER", name: "Prepaid electricity (BPC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "BW-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "BW-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "BW900100", name: "Gaborone Central Market Grocers", category: "Groceries" },
    { code: "BW900200", name: "Francistown Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "BW-BANK1", name: "First National Bank Botswana", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "BW-BANK2", name: "Absa Bank Botswana", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 45_000, dailyMinor: 110_000, monthlyMinor: 450_000, maxBalanceMinor: 450_000 },
    TIER_1: { perTransactionMinor: 1_100_000, dailyMinor: 2_300_000, monthlyMinor: 11_000_000, maxBalanceMinor: 4_500_000 },
    TIER_2: { perTransactionMinor: 11_000_000, dailyMinor: 23_000_000, monthlyMinor: 110_000_000, maxBalanceMinor: 45_000_000 },
  },
};
