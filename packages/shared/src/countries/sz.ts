import type { Country } from "./types";

/**
 * Eswatini — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const SZ: Country = {
  code: "SZ",
  name: "Eswatini",
  flag: "🇸🇿",
  region: "SOUTHERN",
  currency: "SZL",
  callingCode: "+268",
  zone: "CMA",
  launch: "PLANNED",
  regulator: "Central Bank of Eswatini",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "EMALI", label: "e-Mali" },
  ],
  networks: [
    { id: "MTN_SZ", label: "MTN" },
    { id: "ESWATINI_MOBILE", label: "Eswatini Mobile" },
  ],
  agents: [
    { id: "SZ-01", name: "Benki Point Mbabane Centre", location: "Central market, Mbabane" },
    { id: "SZ-02", name: "Benki Point Manzini", location: "Manzini" },
  ],
  billers: [
    { id: "SZ-POWER", name: "Prepaid electricity (EEC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "SZ-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "SZ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "SZ900100", name: "Mbabane Central Market Grocers", category: "Groceries" },
    { code: "SZ900200", name: "Manzini Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "SZ-BANK1", name: "Standard Bank Eswatini", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "SZ-BANK2", name: "FNB Eswatini", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 61_000, dailyMinor: 150_000, monthlyMinor: 610_000, maxBalanceMinor: 610_000 },
    TIER_1: { perTransactionMinor: 1_500_000, dailyMinor: 3_100_000, monthlyMinor: 15_000_000, maxBalanceMinor: 6_100_000 },
    TIER_2: { perTransactionMinor: 15_000_000, dailyMinor: 31_000_000, monthlyMinor: 150_000_000, maxBalanceMinor: 61_000_000 },
  },
};
