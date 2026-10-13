import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import type {
  ApiErrorBody,
  ConversionQuote,
  CurrencyPocket,
  Dispute,
  FeeQuote,
  FxQuote,
  KycResponse,
  LimitsResponse,
  Locale,
  Loan,
  LoanOffer,
  NameEnquiryResponse,
  Notification,
  OtpSendResponse,
  OtpVerifyResponse,
  PaymentRequest,
  PaymentResponse,
  PurposeCode,
  SavingsGroup,
  SavingsVault,
  UserProfile,
  UserTransaction,
  WalletAccount,
} from "@benki/shared";
import { getItem, setItem } from "./storage";

// The Android emulator reaches the host machine at 10.0.2.2; iOS simulator and
// web share the host's localhost. Physical devices need EXPO_PUBLIC_API_BASE_URL.
function defaultBaseUrl(): string {
  return Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000";
}

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultBaseUrl();

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message);
  }
  get code() {
    return this.body.error.code;
  }
}

/** The UI language, sent with every request so errors and confirmations come back translated. */
let requestLocale = "en";
export function setRequestLocale(locale: string) {
  requestLocale = locale;
}

let cachedDeviceId: string | null = null;

/** Stable per-install device ID; the API binds sessions to it. */
export async function deviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;
  const existing = await getItem("benki.deviceId");
  cachedDeviceId = existing ?? `app-${Crypto.randomUUID()}`;
  if (!existing) await setItem("benki.deviceId", cachedDeviceId);
  return cachedDeviceId;
}

export function newIdempotencyKey(): string {
  return `app-${Crypto.randomUUID()}`;
}

async function request<T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "accept-language": requestLocale,
        "x-device-id": await deviceId(),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiRequestError(0, { error: { code: "NETWORK_ERROR", message: "" } });
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, json ?? { error: { code: "INTERNAL_ERROR", message: `Request failed (${res.status})` } });
  return json as T;
}

export const authApi = {
  sendOtp: (phoneNumber: string, countryCode: string) =>
    request<OtpSendResponse>("/v1/auth/otp/send", { method: "POST", body: { phoneNumber, countryCode } }),
  verifyOtp: (phoneNumber: string, otp: string, locale?: Locale) =>
    request<OtpVerifyResponse>("/v1/auth/otp/verify", { method: "POST", body: { phoneNumber, otp, locale } }),
};

interface Movement {
  idempotencyKey: string;
  amountMinor: number;
}
interface Pin {
  pin: string;
}

export function customerApi(token: string) {
  const get = <T,>(path: string) => request<T>(path, { token });
  const post = <T,>(path: string, body?: unknown) => request<T>(path, { method: "POST", token, body: body ?? {} });
  return {
    me: () => get<{ user: UserProfile; wallet: WalletAccount | null }>("/v1/me"),
    limits: () => get<LimitsResponse>("/v1/limits"),
    notifications: () => get<{ notifications: Notification[] }>("/v1/notifications"),
    setLocale: (locale: Locale) => post<{ user: UserProfile }>("/v1/me/locale", { locale }),
    markNotificationsRead: () => post<void>("/v1/notifications/read"),
    pockets: () => get<{ pockets: CurrencyPocket[] }>("/v1/pockets"),
    openPocket: (currency: string) => post<{ pockets: CurrencyPocket[] }>("/v1/pockets", { currency }),
    conversionQuote: (fromCurrency: string, toCurrency: string, sellAmountMinor: number) =>
      post<ConversionQuote>("/v1/pockets/quote", { fromCurrency, toCurrency, sellAmountMinor }),
    convert: (body: Pin & { idempotencyKey: string; quoteId: string }) =>
      post<PaymentResponse & { pockets: CurrencyPocket[] }>("/v1/pockets/convert", body),
    requests: () => get<{ requests: PaymentRequest[] }>("/v1/requests"),
    requestMoney: (payerPhoneNumber: string, amountMinor: number, note?: string) =>
      post<{ request: PaymentRequest }>("/v1/requests", { payerPhoneNumber, amountMinor, note }),
    payRequest: (requestId: string, body: Pin & { idempotencyKey: string }) =>
      post<PaymentResponse & { request: PaymentRequest }>(`/v1/requests/${requestId}/pay`, body),
    declineRequest: (requestId: string) => post<{ request: PaymentRequest }>(`/v1/requests/${requestId}/decline`),
    cancelRequest: (requestId: string) => post<{ request: PaymentRequest }>(`/v1/requests/${requestId}/cancel`),
    setPin: (pin: string) => post<{ user: UserProfile }>("/v1/me/pin", { pin }),
    changePin: (currentPin: string, newPin: string) => post<void>("/v1/me/pin/change", { currentPin, newPin }),
    kycTier1: (body: { fullName: string; dateOfBirth: string; nationalId: string }) => post<KycResponse>("/v1/kyc/tier1", body),
    kycTier2: () => post<KycResponse>("/v1/kyc/tier2", { proofOfAddressConfirmed: true, livenessCheckPassed: true }),
    createWallet: () => post<{ wallet: WalletAccount }>("/v1/wallets"),
    transactions: (walletId: string) => get<{ transactions: UserTransaction[] }>(`/v1/wallets/${walletId}/transactions?limit=100`),
    cashIn: (walletId: string, body: Movement & { agentId: string }) => post<PaymentResponse>(`/v1/wallets/${walletId}/cash-in`, body),
    cashOut: (walletId: string, body: Movement & Pin & { agentId: string }) => post<PaymentResponse>(`/v1/wallets/${walletId}/cash-out`, body),
    airtime: (walletId: string, body: Movement & Pin & { providerId: string; phoneNumber?: string }) =>
      post<PaymentResponse>(`/v1/wallets/${walletId}/airtime-topup`, body),
    p2p: (body: Movement & Pin & { destinationPhoneNumber: string; note?: string }) => post<PaymentResponse>("/v1/transfers/internal", body),
    mobileMoney: (body: Movement & Pin & { providerId: string; destinationPhoneNumber: string }) =>
      post<PaymentResponse>("/v1/transfers/mobile-money", body),
    fxQuote: (destinationCountryCode: string, sendAmountMinor: number) =>
      post<FxQuote>("/v1/transfers/cross-border/quote", { destinationCountryCode, sendAmountMinor }),
    crossBorder: (body: Pin & { idempotencyKey: string; quoteId: string; destinationPhoneNumber: string; purposeCode: PurposeCode }) =>
      post<PaymentResponse>("/v1/transfers/cross-border", body),
    bill: (body: Movement & Pin & { billerId: string; accountNumber: string }) => post<PaymentResponse>("/v1/payments/bills", body),
    merchant: (body: Movement & Pin & { merchantCode: string }) => post<PaymentResponse>("/v1/payments/merchant", body),
    nameEnquiry: (bankId: string, accountNumber: string) =>
      post<NameEnquiryResponse>("/v1/transfers/bank/name-enquiry", { bankId, accountNumber }),
    bankTransfer: (body: Movement & Pin & { bankId: string; accountNumber: string; accountName: string }) =>
      post<PaymentResponse>("/v1/transfers/bank", body),
    loanOffer: () => get<LoanOffer>("/v1/loans/offer"),
    loans: () => get<{ loans: Loan[] }>("/v1/loans"),
    applyLoan: (body: Pin & { idempotencyKey: string; principalMinor: number }) =>
      post<PaymentResponse & { loan: Loan }>("/v1/loans", { ...body, acceptTerms: true }),
    repayLoan: (loanId: string, body: Movement & Pin) => post<PaymentResponse & { loan: Loan }>(`/v1/loans/${loanId}/repay`, body),
    groups: () => get<{ groups: SavingsGroup[] }>("/v1/groups"),
    createGroup: (name: string) => post<{ group: SavingsGroup }>("/v1/groups", { name }),
    addGroupMember: (groupId: string, phoneNumber: string) => post<{ group: SavingsGroup }>(`/v1/groups/${groupId}/members`, { phoneNumber }),
    contribute: (groupId: string, body: Movement & Pin) => post<PaymentResponse>(`/v1/groups/${groupId}/contribute`, body),
    requestPayout: (groupId: string, body: Pin & { recipientUserId: string; amountMinor: number; reason: string }) =>
      post<{ group: SavingsGroup }>(`/v1/groups/${groupId}/payouts`, body),
    votePayout: (groupId: string, requestId: string, approve: boolean, pin: string) =>
      post<{ group: SavingsGroup }>(`/v1/groups/${groupId}/payouts/${requestId}/vote`, { approve, pin }),
    vaults: () => get<{ vaults: SavingsVault[] }>("/v1/savings"),
    createVault: (name: string, targetMinor: number) => post<{ vault: SavingsVault }>("/v1/savings", { name, targetMinor }),
    vaultDeposit: (vaultId: string, body: Movement) => post<PaymentResponse>(`/v1/savings/${vaultId}/deposit`, body),
    vaultWithdraw: (vaultId: string, body: Movement) => post<PaymentResponse>(`/v1/savings/${vaultId}/withdraw`, body),
    disputes: () => get<{ disputes: Dispute[] }>("/v1/disputes"),
    openDispute: (transactionId: string, reason: string) => post<{ dispute: Dispute }>("/v1/disputes", { transactionId, reason }),
    pricing: (type: string, amountMinor: number) => get<FeeQuote>(`/v1/pricing/quote?type=${type}&amountMinor=${amountMinor}`),
    logout: () => post<void>("/v1/auth/logout"),
  };
}

export type CustomerApi = ReturnType<typeof customerApi>;
