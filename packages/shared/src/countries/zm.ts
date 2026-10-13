import type { Country } from "./types";

/**
 * Zambia — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const ZM: Country = {
  code: "ZM",
  name: "Zambia",
  flag: "🇿🇲",
  region: "EAST",
  currency: "ZMW",
  callingCode: "+260",
  launch: "PLANNED",
  regulator: "Bank of Zambia",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
    { id: "ZAMTEL_KWACHA", label: "Zamtel Kwacha" },
  ],
  agents: [
    { id: "ZM-01", name: "Benki Point Lusaka Centre", location: "Central market, Lusaka" },
    { id: "ZM-02", name: "Benki Point Kitwe", location: "Kitwe" },
  ],
  billers: [
    { id: "ZM-POWER", name: "Prepaid electricity (ZESCO)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "ZM-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "ZM-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "ZM900100", name: "Lusaka Central Market Grocers", category: "Groceries" },
    { code: "ZM900200", name: "Kitwe Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "ZM-BANK1", name: "Zanaco", accountNumberPattern: "^[0-9]{10,13}$", accountNumberHint: "10–13 digit account number" },
    { id: "ZM-BANK2", name: "Stanbic Bank Zambia", accountNumberPattern: "^[0-9]{10,13}$", accountNumberHint: "10–13 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 83_000, dailyMinor: 210_000, monthlyMinor: 830_000, maxBalanceMinor: 830_000 },
    TIER_1: { perTransactionMinor: 2_100_000, dailyMinor: 4_200_000, monthlyMinor: 21_000_000, maxBalanceMinor: 8_300_000 },
    TIER_2: { perTransactionMinor: 21_000_000, dailyMinor: 42_000_000, monthlyMinor: 210_000_000, maxBalanceMinor: 83_000_000 },
  },
};
