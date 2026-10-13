import type { Country } from "./types";

/**
 * Lesotho — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const LS: Country = {
  code: "LS",
  name: "Lesotho",
  flag: "🇱🇸",
  region: "SOUTHERN",
  currency: "LSL",
  callingCode: "+266",
  zone: "CMA",
  launch: "PLANNED",
  regulator: "Central Bank of Lesotho",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "MPESA", label: "M-Pesa (Vodacom)" },
    { id: "ECOCASH", label: "EcoCash" },
  ],
  networks: [
    { id: "VODACOM_LS", label: "Vodacom" },
    { id: "ECONET_LS", label: "Econet Telecom Lesotho" },
  ],
  agents: [
    { id: "LS-01", name: "Benki Point Maseru Centre", location: "Central market, Maseru" },
    { id: "LS-02", name: "Benki Point Teyateyaneng", location: "Teyateyaneng" },
  ],
  billers: [
    { id: "LS-POWER", name: "Prepaid electricity (LEC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "LS-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "LS-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "LS900100", name: "Maseru Central Market Grocers", category: "Groceries" },
    { code: "LS900200", name: "Teyateyaneng Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "LS-BANK1", name: "Standard Lesotho Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "LS-BANK2", name: "FNB Lesotho", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 61_000, dailyMinor: 150_000, monthlyMinor: 610_000, maxBalanceMinor: 610_000 },
    TIER_1: { perTransactionMinor: 1_500_000, dailyMinor: 3_100_000, monthlyMinor: 15_000_000, maxBalanceMinor: 6_100_000 },
    TIER_2: { perTransactionMinor: 15_000_000, dailyMinor: 31_000_000, monthlyMinor: 150_000_000, maxBalanceMinor: 61_000_000 },
  },
};
