import type { Country } from "./types";

/**
 * Kenya — live.
 */
export const KE: Country = {
  code: "KE",
  name: "Kenya",
  flag: "🇰🇪",
  region: "EAST",
  currency: "KES",
  callingCode: "+254",
  launch: "LIVE",
  regulator: "Central Bank of Kenya",
  languages: { default: "en", offered: ["en", "sw"] },
  mobileMoneyProviders: [
    { id: "MPESA", label: "M-Pesa (Safaricom)" },
  ],
  agents: [
    { id: "KE-01", name: "Amani Mobile Money Kiosk", location: "Kibera, Nairobi" },
    { id: "KE-02", name: "Baraka General Store", location: "Kisumu" },
  ],
  billers: [
    { id: "KE-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: "^[0-9]{11}$", accountNumberHint: "11-digit meter number" },
    { id: "KE-WATER", name: "Nairobi water utility", category: "WATER", issuesToken: false, accountNumberPattern: "^[0-9A-Z]{6,13}$", accountNumberHint: "Account number" },
  ],
  merchants: [
    { code: "KE500100", name: "Mama Mboga Fresh Produce", category: "Groceries" },
    { code: "KE500200", name: "Upendo Community Pharmacy", category: "Pharmacy" },
  ],
  banks: [
    { id: "KE-EQUITY", name: "Equity Bank", accountNumberPattern: "^[0-9]{10,13}$", accountNumberHint: "10–13 digit account number" },
    { id: "KE-KCB", name: "KCB Bank", accountNumberPattern: "^[0-9]{10,13}$", accountNumberHint: "10–13 digit account number" },
  ],
  limits: {
    TIER_0: { perTransactionMinor: 200_000, dailyMinor: 500_000, monthlyMinor: 2_000_000, maxBalanceMinor: 1_000_000 },
    TIER_1: { perTransactionMinor: 5_000_000, dailyMinor: 15_000_000, monthlyMinor: 50_000_000, maxBalanceMinor: 30_000_000 },
    TIER_2: { perTransactionMinor: 50_000_000, dailyMinor: 100_000_000, monthlyMinor: 500_000_000, maxBalanceMinor: 300_000_000 },
  },
};
