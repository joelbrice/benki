import type { Country } from "./types";

/**
 * Cabo Verde — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const CV: Country = {
  code: "CV",
  name: "Cabo Verde",
  flag: "🇨🇻",
  region: "WEST",
  currency: "CVE",
  callingCode: "+238",
  launch: "PLANNED",
  regulator: "Banco de Cabo Verde",
  languages: { default: "pt", offered: ["pt", "en"] },
  mobileMoneyProviders: [],
  networks: [
    { id: "CVMOVEL", label: "CVMóvel" },
    { id: "UNITEL_TMAIS", label: "Unitel T+" },
  ],
  agents: [
    { id: "CV-01", name: "Benki Point Praia Centre", location: "Central market, Praia" },
    { id: "CV-02", name: "Benki Point Mindelo", location: "Mindelo" },
  ],
  billers: [
    { id: "CV-POWER", name: "Prepaid electricity (Electra)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "CV-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "CV-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "CV900100", name: "Praia Central Market Grocers", category: "Groceries" },
    { code: "CV900200", name: "Farmácia Mindelo", category: "Pharmacy" },
  ],
  banks: [
    { id: "CV-BANK1", name: "Caixa Económica de Cabo Verde", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "CV-BANK2", name: "Banco Comercial do Atlântico", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 340_000, dailyMinor: 840_000, monthlyMinor: 3_400_000, maxBalanceMinor: 3_400_000 },
    TIER_1: { perTransactionMinor: 8_400_000, dailyMinor: 17_000_000, monthlyMinor: 84_000_000, maxBalanceMinor: 34_000_000 },
    TIER_2: { perTransactionMinor: 84_000_000, dailyMinor: 170_000_000, monthlyMinor: 840_000_000, maxBalanceMinor: 340_000_000 },
  },
};
