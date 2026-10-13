import type { Country } from "./types";

/**
 * Mozambique — Planned. Partners, agents and limits are placeholders until launch preparation.
 */
export const MZ: Country = {
  code: "MZ",
  name: "Mozambique",
  flag: "🇲🇿",
  region: "EAST",
  currency: "MZN",
  callingCode: "+258",
  launch: "PLANNED",
  regulator: "Banco de Moçambique",
  languages: { default: "pt", offered: ["pt", "en", "sw"] },
  mobileMoneyProviders: [
    { id: "MPESA", label: "M-Pesa (Vodacom)" },
    { id: "EMOLA", label: "e-Mola (Movitel)" },
    { id: "MKESH", label: "mKesh (Tmcel)" },
  ],
  agents: [
    { id: "MZ-01", name: "Benki Point Maputo Centre", location: "Central market, Maputo" },
    { id: "MZ-02", name: "Benki Point Beira", location: "Beira" },
  ],
  billers: [
    { id: "MZ-POWER", name: "Prepaid electricity (EDM Credelec)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "MZ-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
    { id: "MZ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Student reference" },
  ],
  merchants: [
    { code: "MZ900100", name: "Maputo Central Market Grocers", category: "Groceries" },
    { code: "MZ900200", name: "Farmácia Beira", category: "Pharmacy" },
  ],
  banks: [
    { id: "MZ-BANK1", name: "Millennium bim", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
    { id: "MZ-BANK2", name: "BCI", accountNumberPattern: "^[0-9]{8,16}$", accountNumberHint: "8–16 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 210_000, dailyMinor: 530_000, monthlyMinor: 2_100_000, maxBalanceMinor: 2_100_000 },
    TIER_1: { perTransactionMinor: 5_300_000, dailyMinor: 11_000_000, monthlyMinor: 53_000_000, maxBalanceMinor: 21_000_000 },
    TIER_2: { perTransactionMinor: 53_000_000, dailyMinor: 110_000_000, monthlyMinor: 530_000_000, maxBalanceMinor: 210_000_000 },
  },
};
