import type { Country } from "./types";

/**
 * Republic of the Congo — live.
 */
export const CG: Country = {
  code: "CG",
  name: "Republic of the Congo",
  flag: "🇨🇬",
  region: "CENTRAL",
  currency: "XAF",
  callingCode: "+242",
  zone: "CEMAC",
  launch: "LIVE",
  regulator: "COBAC / BEAC",
  languages: { default: "fr", offered: ["fr", "ln"] },
  mobileMoneyProviders: [
    { id: "MTN_MOMO", label: "MTN Mobile Money" },
    { id: "AIRTEL_MONEY", label: "Airtel Money" },
  ],
  agents: [
    { id: "CG-01", name: "Ets. Mabiala", location: "Marché Total, Brazzaville" },
    { id: "CG-02", name: "Point Cash Tié-Tié", location: "Pointe-Noire" },
  ],
  billers: [
    { id: "CG-POWER", name: "Prepaid electricity (E²C)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "CG-WATER", name: "Water utility (LCDE)", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
  ],
  merchants: [
    { code: "CG140100", name: "Saka-Saka de Poto-Poto", category: "Food" },
    { code: "CG140200", name: "Couture La Sapeuse", category: "Clothing" },
  ],
  banks: [
    { id: "CG-BGFI", name: "BGFIBank Congo", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
    { id: "CG-LCB", name: "LCB Bank", accountNumberPattern: "^[0-9A-Z]{23}$", accountNumberHint: "Account number (RIB)" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 20_000, dailyMinor: 50_000, monthlyMinor: 200_000, maxBalanceMinor: 200_000 },
    TIER_1: { perTransactionMinor: 500_000, dailyMinor: 1_000_000, monthlyMinor: 5_000_000, maxBalanceMinor: 2_000_000 },
    TIER_2: { perTransactionMinor: 5_000_000, dailyMinor: 10_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 20_000_000 },
  },
};
