import type { Country } from "./types";

/**
 * Gambia — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const GM: Country = {
  code: "GM",
  name: "Gambia",
  flag: "🇬🇲",
  region: "WEST",
  currency: "GMD",
  callingCode: "+220",
  launch: "PLANNED",
  regulator: "Central Bank of The Gambia",
  languages: { default: "en", offered: ["en", "wo"] },
  mobileMoneyProviders: [
    { id: "AFRICELL_MONEY", label: "Africell Money" },
    { id: "QMONEY", label: "QMoney" },
    { id: "WAVE", label: "Wave" },
  ],
  networks: [
    { id: "AFRICELL_GM", label: "Africell" },
    { id: "QCELL", label: "QCell" },
    { id: "GAMCEL", label: "Gamcel" },
  ],
  agents: [
    { id: "GM-01", name: "Benki Point Banjul Centre", location: "Central market, Banjul" },
    { id: "GM-02", name: "Benki Point Serekunda", location: "Serekunda" },
  ],
  billers: [
    { id: "GM-POWER", name: "Prepaid electricity (NAWEC)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "GM-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "GM-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "GM900100", name: "Banjul Central Market Grocers", category: "Groceries" },
    { code: "GM900200", name: "Serekunda Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "GM-BANK1", name: "Trust Bank Gambia", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "GM-BANK2", name: "Ecobank Gambia", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 240_000, dailyMinor: 590_000, monthlyMinor: 2_400_000, maxBalanceMinor: 2_400_000 },
    TIER_1: { perTransactionMinor: 5_900_000, dailyMinor: 12_000_000, monthlyMinor: 59_000_000, maxBalanceMinor: 24_000_000 },
    TIER_2: { perTransactionMinor: 59_000_000, dailyMinor: 120_000_000, monthlyMinor: 590_000_000, maxBalanceMinor: 240_000_000 },
  },
};
