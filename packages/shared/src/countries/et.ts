import type { Country } from "./types";

/**
 * Ethiopia — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const ET: Country = {
  code: "ET",
  name: "Ethiopia",
  flag: "🇪🇹",
  region: "EAST",
  currency: "ETB",
  callingCode: "+251",
  launch: "PLANNED",
  regulator: "National Bank of Ethiopia",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "TELEBIRR", label: "telebirr" },
    { id: "MPESA", label: "M-Pesa (Safaricom Ethiopia)" },
  ],
  networks: [
    { id: "ETHIO_TELECOM", label: "Ethio telecom" },
    { id: "SAFARICOM_ET", label: "Safaricom Ethiopia" },
  ],
  agents: [
    { id: "ET-01", name: "Benki Point Addis Ababa Centre", location: "Central market, Addis Ababa" },
    { id: "ET-02", name: "Benki Point Hawassa", location: "Hawassa" },
  ],
  billers: [
    { id: "ET-POWER", name: "Prepaid electricity (EEU)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "ET-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "ET-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "ET900100", name: "Addis Ababa Central Market Grocers", category: "Groceries" },
    { code: "ET900200", name: "Hawassa Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "ET-BANK1", name: "Commercial Bank of Ethiopia", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
    { id: "ET-BANK2", name: "Awash Bank", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 470_000, dailyMinor: 1_200_000, monthlyMinor: 4_700_000, maxBalanceMinor: 4_700_000 },
    TIER_1: { perTransactionMinor: 12_000_000, dailyMinor: 23_000_000, monthlyMinor: 120_000_000, maxBalanceMinor: 47_000_000 },
    TIER_2: { perTransactionMinor: 120_000_000, dailyMinor: 230_000_000, monthlyMinor: 1_200_000_000, maxBalanceMinor: 470_000_000 },
  },
};
