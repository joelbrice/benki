import type { Country } from "./types";

/**
 * Eritrea — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const ER: Country = {
  code: "ER",
  name: "Eritrea",
  flag: "🇪🇷",
  region: "EAST",
  currency: "ERN",
  callingCode: "+291",
  launch: "PLANNED",
  regulator: "Bank of Eritrea",
  languages: { default: "en", offered: ["en", "ar"] },
  mobileMoneyProviders: [],
  networks: [
    { id: "ERITEL", label: "EriTel" },
  ],
  agents: [
    { id: "ER-01", name: "Benki Point Asmara Centre", location: "Central market, Asmara" },
    { id: "ER-02", name: "Benki Point Keren", location: "Keren" },
  ],
  billers: [
    { id: "ER-POWER", name: "Prepaid electricity (EEC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "ER-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "ER-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "ER900100", name: "Asmara Central Market Grocers", category: "Groceries" },
    { code: "ER900200", name: "Keren Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "ER-BANK1", name: "Commercial Bank of Eritrea", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "ER-BANK2", name: "Housing & Commerce Bank of Eritrea", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 50_000, dailyMinor: 120_000, monthlyMinor: 500_000, maxBalanceMinor: 500_000 },
    TIER_1: { perTransactionMinor: 1_200_000, dailyMinor: 2_500_000, monthlyMinor: 13_000_000, maxBalanceMinor: 5_000_000 },
    TIER_2: { perTransactionMinor: 13_000_000, dailyMinor: 25_000_000, monthlyMinor: 120_000_000, maxBalanceMinor: 50_000_000 },
  },
};
