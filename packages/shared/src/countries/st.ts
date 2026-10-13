import type { Country } from "./types";

/**
 * São Tomé and Príncipe — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const ST: Country = {
  code: "ST",
  name: "São Tomé and Príncipe",
  flag: "🇸🇹",
  region: "CENTRAL",
  currency: "STN",
  callingCode: "+239",
  launch: "PLANNED",
  regulator: "Banco Central de São Tomé e Príncipe",
  languages: { default: "pt", offered: ["pt", "fr"] },
  mobileMoneyProviders: [],
  networks: [
    { id: "CST", label: "CST" },
    { id: "UNITEL_STP", label: "Unitel STP" },
  ],
  agents: [
    { id: "ST-01", name: "Benki Point São Tomé Centre", location: "Central market, São Tomé" },
    { id: "ST-02", name: "Benki Point Neves", location: "Neves" },
  ],
  billers: [
    { id: "ST-POWER", name: "Prepaid electricity (EMAE)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "ST-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "ST-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "ST900100", name: "São Tomé Central Market Grocers", category: "Groceries" },
    { code: "ST900200", name: "Farmácia Neves", category: "Pharmacy" },
  ],
  banks: [
    { id: "ST-BANK1", name: "BISTP", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "ST-BANK2", name: "Ecobank São Tomé", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 75_000, dailyMinor: 190_000, monthlyMinor: 750_000, maxBalanceMinor: 750_000 },
    TIER_1: { perTransactionMinor: 1_900_000, dailyMinor: 3_800_000, monthlyMinor: 19_000_000, maxBalanceMinor: 7_500_000 },
    TIER_2: { perTransactionMinor: 19_000_000, dailyMinor: 38_000_000, monthlyMinor: 190_000_000, maxBalanceMinor: 75_000_000 },
  },
};
