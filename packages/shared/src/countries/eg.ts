import type { Country } from "./types";

/**
 * Egypt — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const EG: Country = {
  code: "EG",
  name: "Egypt",
  flag: "🇪🇬",
  region: "NORTH",
  currency: "EGP",
  callingCode: "+20",
  launch: "PLANNED",
  regulator: "Central Bank of Egypt",
  languages: { default: "ar", offered: ["ar", "en"] },
  mobileMoneyProviders: [
    { id: "VODAFONE_CASH", label: "Vodafone Cash" },
    { id: "ORANGE_CASH", label: "Orange Cash" },
    { id: "ETISALAT_CASH", label: "e& cash" },
  ],
  networks: [
    { id: "VODAFONE_EG", label: "Vodafone" },
    { id: "ORANGE_EG", label: "Orange" },
    { id: "ETISALAT_EG", label: "e&" },
    { id: "WE_EG", label: "WE" },
  ],
  agents: [
    { id: "EG-01", name: "Benki Point Cairo Centre", location: "Central market, Cairo" },
    { id: "EG-02", name: "Benki Point Alexandria", location: "Alexandria" },
  ],
  billers: [
    { id: "EG-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "EG-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "EG-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "EG900100", name: "Cairo Central Market Grocers", category: "Groceries" },
    { code: "EG900200", name: "Pharmacie Alexandria", category: "Pharmacy" },
  ],
  banks: [
    { id: "EG-BANK1", name: "National Bank of Egypt", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
    { id: "EG-BANK2", name: "Banque Misr", accountNumberPattern: "^[0-9]{10,16}$", accountNumberHint: "10–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 160_000, dailyMinor: 410_000, monthlyMinor: 1_600_000, maxBalanceMinor: 1_600_000 },
    TIER_1: { perTransactionMinor: 4_100_000, dailyMinor: 8_200_000, monthlyMinor: 41_000_000, maxBalanceMinor: 16_000_000 },
    TIER_2: { perTransactionMinor: 41_000_000, dailyMinor: 82_000_000, monthlyMinor: 410_000_000, maxBalanceMinor: 160_000_000 },
  },
};
