// Shared reference data. Each country lives in its own module under
// ./countries; this file holds what spans countries (FX reference rates,
// remittance purposes) and convenience lookups. Nothing here is a statement
// about actual partnerships.
import { AFRICAN_COUNTRIES, COUNTRY_BY_CODE, type Bank, type Country, type Merchant } from "./countries";

export * from "./countries";

export function findMerchant(code: string): { country: Country; merchant: Merchant } | undefined {
  for (const country of AFRICAN_COUNTRIES) {
    const merchant = country.merchants.find((m) => m.code === code);
    if (merchant) return { country, merchant };
  }
  return undefined;
}

// Remittance purpose codes (docs/API_SPECIFICATION.md section 3 "purposeCode").
export const PURPOSE_CODES = [
  { id: "FAMILY_SUPPORT", label: "Family support" },
  { id: "EDUCATION", label: "Education" },
  { id: "MEDICAL", label: "Medical" },
  { id: "BUSINESS", label: "Business / trade" },
  { id: "SAVINGS", label: "Savings" },
  { id: "OTHER", label: "Other" },
] as const;

export type PurposeCode = (typeof PURPOSE_CODES)[number]["id"];

/**
 * Illustrative mid-market rates expressed as units of each currency per 1 USD.
 * A real deployment sources these from a rates provider with freshness checks.
 */
export const FX_UNITS_PER_USD: Record<string, number> = {
  // Live markets
  XAF: 600,
  // XAF and XOF are both pegged at 655.957 per euro, so they trade at par.
  XOF: 600,
  CDF: 2800,
  KES: 129.0,
  GHS: 15.5,
  NGN: 1550,
  TZS: 2600,
  // Planned markets (the rand, loti, lilangeni and Namibian dollar are at par in the CMA)
  AOA: 920,
  STN: 22.5,
  GNF: 8650,
  MRU: 39.9,
  GMD: 71,
  SLE: 22.8,
  LRD: 199,
  CVE: 101,
  UGX: 3650,
  RWF: 1440,
  BIF: 2950,
  ETB: 140,
  SOS: 571,
  SSP: 4500,
  DJF: 177.7,
  ERN: 15,
  MGA: 4500,
  KMF: 452,
  MUR: 46,
  SCR: 14.3,
  MWK: 1750,
  MZN: 63.9,
  ZMW: 25,
  ZWG: 26.8,
  ZAR: 18.3,
  NAD: 18.3,
  BWP: 13.6,
  SZL: 18.3,
  LSL: 18.3,
  EGP: 49,
  MAD: 9.3,
  DZD: 133,
  TND: 3.1,
  LYD: 5.45,
  SDG: 600,
  // Pocket currencies
  USD: 1,
  EUR: 0.92,
};

/** Hard currencies customers can hold alongside their local wallet. */
export const POCKET_CURRENCIES = ["USD", "EUR"] as const;
export type PocketCurrency = (typeof POCKET_CURRENCIES)[number];

/** Banks by country, from each country module. */
export const BANKS: Record<string, Bank[]> = Object.fromEntries(AFRICAN_COUNTRIES.map((c) => [c.code, c.banks]));

export function banksFor(countryCode: string): Bank[] {
  return COUNTRY_BY_CODE[countryCode]?.banks ?? [];
}

/** USSD short code shown on feature phones; illustrative. */
export const USSD_SHORT_CODE = "*384*236#";
