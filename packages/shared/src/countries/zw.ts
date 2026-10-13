import type { Country } from "./types";

/**
 * Zimbabwe — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const ZW: Country = {
  code: "ZW",
  name: "Zimbabwe",
  flag: "🇿🇼",
  region: "EAST",
  currency: "ZWG",
  callingCode: "+263",
  launch: "PLANNED",
  regulator: "Reserve Bank of Zimbabwe",
  languages: { default: "en", offered: ["en"] },
  mobileMoneyProviders: [
    { id: "ECOCASH", label: "EcoCash" },
    { id: "ONEMONEY", label: "OneMoney" },
    { id: "INNBUCKS", label: "InnBucks" },
  ],
  networks: [
    { id: "ECONET", label: "Econet" },
    { id: "NETONE", label: "NetOne" },
    { id: "TELECEL_ZW", label: "Telecel" },
  ],
  agents: [
    { id: "ZW-01", name: "Benki Point Harare Centre", location: "Central market, Harare" },
    { id: "ZW-02", name: "Benki Point Bulawayo", location: "Bulawayo" },
  ],
  billers: [
    { id: "ZW-POWER", name: "Prepaid electricity (ZETDC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "ZW-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "ZW-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "ZW900100", name: "Harare Central Market Grocers", category: "Groceries" },
    { code: "ZW900200", name: "Bulawayo Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "ZW-BANK1", name: "CBZ Bank", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "ZW-BANK2", name: "Stanbic Bank Zimbabwe", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 89_000, dailyMinor: 220_000, monthlyMinor: 890_000, maxBalanceMinor: 890_000 },
    TIER_1: { perTransactionMinor: 2_200_000, dailyMinor: 4_500_000, monthlyMinor: 22_000_000, maxBalanceMinor: 8_900_000 },
    TIER_2: { perTransactionMinor: 22_000_000, dailyMinor: 45_000_000, monthlyMinor: 220_000_000, maxBalanceMinor: 89_000_000 },
  },
};
