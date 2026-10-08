// Market catalog for the demo: a small, illustrative subset of the markets in
// docs/COUNTRY_COMPLIANCE_MATRIX.md. Real launches are governed by the full
// compliance matrix; nothing here is a statement about actual partnerships.

export interface MobileMoneyProvider {
  id: string;
  label: string;
}

export interface Agent {
  id: string;
  name: string;
  location: string;
}

export type BillerCategory = "ELECTRICITY" | "WATER" | "TV" | "SCHOOL_FEES";

export interface Biller {
  id: string;
  name: string;
  category: BillerCategory;
  /** Prepaid electricity returns a meter token the customer types into the meter. */
  issuesToken: boolean;
  accountNumberPattern: string;
  accountNumberHint: string;
}

export interface Merchant {
  code: string;
  name: string;
  category: string;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  callingCode: string;
  mobileMoneyProviders: MobileMoneyProvider[];
  agents: Agent[];
  billers: Biller[];
  merchants: Merchant[];
}

const METER = "^[0-9]{11}$";
const ACCOUNT = "^[0-9A-Z]{6,13}$";

export const AFRICAN_COUNTRIES: Country[] = [
  {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    callingCode: "+254",
    mobileMoneyProviders: [{ id: "MPESA", label: "M-Pesa (Safaricom)" }],
    agents: [
      { id: "KE-01", name: "Amani Mobile Money Kiosk", location: "Kibera, Nairobi" },
      { id: "KE-02", name: "Baraka General Store", location: "Kisumu" },
    ],
    billers: [
      { id: "KE-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "KE-WATER", name: "Nairobi water utility", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "KE500100", name: "Mama Mboga Fresh Produce", category: "Groceries" },
      { code: "KE500200", name: "Upendo Community Pharmacy", category: "Pharmacy" },
    ],
  },
  {
    code: "GH",
    name: "Ghana",
    currency: "GHS",
    callingCode: "+233",
    mobileMoneyProviders: [
      { id: "MTN_MOMO", label: "MTN Mobile Money" },
      { id: "AIRTELTIGO", label: "AirtelTigo Money" },
    ],
    agents: [
      { id: "GH-01", name: "Abena's Corner Shop", location: "Accra" },
      { id: "GH-02", name: "Kwame Electronics", location: "Kumasi" },
    ],
    billers: [
      { id: "GH-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "GH-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "GH600100", name: "Akwaaba Chop Bar", category: "Food" },
      { code: "GH600200", name: "Kente Weavers Cooperative", category: "Crafts" },
    ],
  },
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    callingCode: "+234",
    mobileMoneyProviders: [
      { id: "MTN_MOMO", label: "MTN Mobile Money" },
      { id: "OPAY", label: "OPay" },
    ],
    agents: [
      { id: "NG-01", name: "Chidinma Provisions", location: "Lagos" },
      { id: "NG-02", name: "Ibrahim Mobile Money", location: "Kano" },
    ],
    billers: [
      { id: "NG-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "NG-TV", name: "Pay TV subscription", category: "TV", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Smartcard number" },
    ],
    merchants: [
      { code: "NG700100", name: "Iya Basira Foodstuff", category: "Groceries" },
      { code: "NG700200", name: "Oluwaseun Tailoring", category: "Clothing" },
    ],
  },
  {
    code: "TZ",
    name: "Tanzania",
    currency: "TZS",
    callingCode: "+255",
    mobileMoneyProviders: [
      { id: "MPESA", label: "M-Pesa (Vodacom)" },
      { id: "TIGOPESA", label: "Tigo Pesa" },
    ],
    agents: [
      { id: "TZ-01", name: "Neema Duka", location: "Dar es Salaam" },
      { id: "TZ-02", name: "Juma's Kiosk", location: "Arusha" },
    ],
    billers: [
      { id: "TZ-POWER", name: "Prepaid electricity (LUKU)", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "TZ-SCHOOL", name: "School fees collection", category: "SCHOOL_FEES", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Student reference" },
    ],
    merchants: [
      { code: "TZ800100", name: "Kariakoo Spices", category: "Groceries" },
      { code: "TZ800200", name: "Bahari Fish Market", category: "Food" },
    ],
  },
  {
    code: "SN",
    name: "Senegal",
    currency: "XOF",
    callingCode: "+221",
    mobileMoneyProviders: [
      { id: "ORANGE_MONEY", label: "Orange Money" },
      { id: "WAVE", label: "Wave" },
    ],
    agents: [
      { id: "SN-01", name: "Boutique Fatou", location: "Dakar" },
      { id: "SN-02", name: "Kiosque Moussa", location: "Thiès" },
    ],
    billers: [
      { id: "SN-POWER", name: "Prepaid electricity", category: "ELECTRICITY", issuesToken: true, accountNumberPattern: METER, accountNumberHint: "11-digit meter number" },
      { id: "SN-WATER", name: "Water utility", category: "WATER", issuesToken: false, accountNumberPattern: ACCOUNT, accountNumberHint: "Account number" },
    ],
    merchants: [
      { code: "SN900100", name: "Marché Sandaga Tissus", category: "Textiles" },
      { code: "SN900200", name: "Dibiterie Teranga", category: "Food" },
    ],
  },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  AFRICAN_COUNTRIES.map((c) => [c.code, c]),
);

export const DEFAULT_COUNTRY_CODE = "SN";

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
  KES: 129.0,
  GHS: 15.5,
  NGN: 1550,
  TZS: 2600,
  XOF: 600,
};
