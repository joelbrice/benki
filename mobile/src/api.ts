import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import type {
  ApiErrorBody,
  Dispute,
  FeeQuote,
  FxQuote,
  KycResponse,
  LimitsResponse,
  Notification,
  OtpSendResponse,
  OtpVerifyResponse,
  PaymentResponse,
  PurposeCode,
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
        "x-device-id": await deviceId(),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiRequestError(0, {
      error: { code: "INTERNAL_ERROR", message: "Can't reach Benki right now. Check your connection and try again." },
    });
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, json ?? { error: { code: "INTERNAL_ERROR", message: `Request failed (${res.status})` } });
  return json as T;
}

export const authApi = {
  sendOtp: (phoneNumber: string, countryCode: string) =>
    request<OtpSendResponse>("/v1/auth/otp/send", { method: "POST", body: { phoneNumber, countryCode } }),
  verifyOtp: (phoneNumber: string, otp: string) =>
    request<OtpVerifyResponse>("/v1/auth/otp/verify", { method: "POST", body: { phoneNumber, otp } }),
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
