// Domain types mirroring app/src/main/java/com/example/benki/domain/Models.kt,
// scoped to the vertical slice described in docs/PRD.md and docs/API_SPECIFICATION.md.

export type KycTier = "TIER_0" | "TIER_1" | "TIER_2";

export type JourneyStep = "ONBOARDING" | "KYC" | "WALLET" | "TRANSFER" | "HISTORY";

export type TransactionType =
  | "CASH_IN"
  | "CASH_OUT"
  | "TRANSFER_OUT"
  | "TRANSFER_IN"
  | "MOBILE_MONEY_OUT"
  | "AIRTIME_TOPUP";

export type TransferStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export interface UserProfile {
  userId: string;
  phoneNumber: string;
  countryCode: string;
  kycTier: KycTier;
  walletId: string | null;
  nationalId: string | null;
  proofOfAddressConfirmed: boolean;
}

export interface WalletAccount {
  walletId: string;
  ownerUserId: string;
  currency: string;
  availableBalanceMinor: number;
  pendingBalanceMinor: number;
  reservedBalanceMinor: number;
}

export interface WalletTransaction {
  reference: string;
  walletId: string;
  type: TransactionType;
  amountMinor: number;
  counterparty: string;
  note: string;
  createdAt: string;
}

// --- Country / currency / rail catalog (docs/COUNTRY_COMPLIANCE_MATRIX.md) ---
// A small, illustrative subset of the markets Benki targets. Real launches are
// governed by the full compliance matrix; this catalog only backs the demo.

export interface MobileMoneyProvider {
  id: string;
  label: string;
}

export interface Agent {
  id: string;
  name: string;
  location: string;
}

export interface Country {
  code: string;
  name: string;
  currency: string;
  callingCode: string;
  mobileMoneyProviders: MobileMoneyProvider[];
  agents: Agent[];
}

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
  },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  AFRICAN_COUNTRIES.map((c) => [c.code, c]),
);

export const DEFAULT_COUNTRY_CODE = "SN";

// Currencies with no minor subdivision in everyday use (docs call out that
// limits and amounts are country/currency-specific, not a single flat number).
const ZERO_DECIMAL_CURRENCIES = new Set(["XOF", "XAF", "UGX", "RWF"]);

export function minorUnitsPerMajor(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100;
}

export function formatAmount(amountMinor: number, currency: string): string {
  const scale = minorUnitsPerMajor(currency);
  const decimals = scale === 1 ? 0 : 2;
  const major = amountMinor / scale;
  return `${major.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${currency}`;
}

// Per-country, per-tier transfer limits, in that country's minor units —
// docs/COUNTRY_COMPLIANCE_MATRIX.md lists "maximum balance and transaction
// limits by tier" as a required field per country, so a single flat number
// across currencies isn't representative. Figures here are illustrative.
export const TRANSFER_LIMITS_MINOR: Record<string, Record<KycTier, number>> = {
  KE: { TIER_0: 200_000, TIER_1: 5_000_000, TIER_2: 50_000_000 }, // KES 2,000 / 50,000 / 500,000
  GH: { TIER_0: 15_000, TIER_1: 300_000, TIER_2: 3_000_000 }, // GHS 150 / 3,000 / 30,000
  NG: { TIER_0: 2_000_000, TIER_1: 50_000_000, TIER_2: 500_000_000 }, // NGN 20,000 / 500,000 / 5,000,000
  TZ: { TIER_0: 5_000_000, TIER_1: 100_000_000, TIER_2: 1_000_000_000 }, // TZS 50,000 / 1,000,000 / 10,000,000
  SN: { TIER_0: 20_000, TIER_1: 500_000, TIER_2: 5_000_000 }, // XOF 20,000 / 500,000 / 5,000,000
};

export function transferLimitMinor(countryCode: string, tier: KycTier): number {
  return TRANSFER_LIMITS_MINOR[countryCode]?.[tier] ?? TRANSFER_LIMITS_MINOR[DEFAULT_COUNTRY_CODE][tier];
}

// --- API request/response contracts (docs/API_SPECIFICATION.md, section 2 & 3) ---

export interface OtpSendRequest {
  phoneNumber: string;
  countryCode: string;
}

export interface OtpSendResponse {
  requestId: string;
  /** Returned only because this is a mock backend with no SMS provider wired up. */
  devOtp: string;
}

export interface OtpVerifyRequest {
  phoneNumber: string;
  otp: string;
}

export interface OtpVerifyResponse {
  token: string;
  user: UserProfile;
}

export interface KycStatusResponse {
  kycTier: KycTier;
}

export interface KycTier1Request {
  nationalId: string;
}

export interface KycTier2Request {
  proofOfAddressConfirmed: boolean;
}

export interface WalletCreateResponse {
  wallet: WalletAccount;
}

export interface WalletBalancesResponse {
  wallet: WalletAccount;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransaction[];
}

export interface CashInRequest {
  amountMinor: number;
  agentId: string;
}

export interface CashOutRequest {
  amountMinor: number;
  agentId: string;
}

export interface WalletActionResponse {
  wallet: WalletAccount;
  transaction: WalletTransaction;
}

export interface InternalTransferRequest {
  idempotencyKey: string;
  destinationPhoneNumber: string;
  amountMinor: number;
  currency: string;
  note?: string;
}

export interface InternalTransferResponse {
  transferId: string;
  status: TransferStatus;
  wallet: WalletAccount;
  transaction: WalletTransaction;
}

export interface MobileMoneyTransferRequest {
  idempotencyKey: string;
  providerId: string;
  destinationPhoneNumber: string;
  amountMinor: number;
  currency: string;
  note?: string;
}

export interface MobileMoneyTransferResponse {
  transferId: string;
  status: TransferStatus;
  wallet: WalletAccount;
  transaction: WalletTransaction;
}

export interface AirtimeTopUpRequest {
  providerId: string;
  amountMinor: number;
  phoneNumber?: string;
}

export interface ApiErrorBody {
  error: {
    code:
      | "VALIDATION_ERROR"
      | "AUTH_ERROR"
      | "NOT_FOUND"
      | "COMPLIANCE_BLOCK"
      | "INSUFFICIENT_FUNDS"
      | "INTERNAL_ERROR";
    message: string;
  };
}
