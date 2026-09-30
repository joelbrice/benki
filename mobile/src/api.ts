import { Platform } from "react-native";
import type {
  AirtimeTopUpRequest,
  ApiErrorBody,
  CashInRequest,
  CashOutRequest,
  InternalTransferRequest,
  InternalTransferResponse,
  KycStatusResponse,
  MobileMoneyTransferRequest,
  MobileMoneyTransferResponse,
  OtpSendResponse,
  OtpVerifyResponse,
  WalletActionResponse,
  WalletCreateResponse,
  WalletTransactionsResponse,
} from "./types";

// The Android emulator can't reach the host machine's localhost directly —
// 10.0.2.2 is its alias for the host loopback. iOS simulator and web both
// share the host's localhost. A physical device needs a LAN IP, set via
// EXPO_PUBLIC_API_BASE_URL.
function defaultBaseUrl(): string {
  if (Platform.OS === "android") return "http://10.0.2.2:4000";
  return "http://localhost:4000";
}

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultBaseUrl();

export class ApiRequestError extends Error {
  constructor(readonly body: ApiErrorBody) {
    super(body.error.message);
  }
}

async function request<T>(
  path: string,
  options: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new ApiRequestError(json as ApiErrorBody);
  return json as T;
}

export const api = {
  sendOtp: (phoneNumber: string, countryCode: string) =>
    request<OtpSendResponse>("/v1/auth/otp/send", { method: "POST", body: { phoneNumber, countryCode } }),

  verifyOtp: (phoneNumber: string, otp: string) =>
    request<OtpVerifyResponse>("/v1/auth/otp/verify", { method: "POST", body: { phoneNumber, otp } }),

  upgradeKycTier1: (token: string, nationalId: string) =>
    request<KycStatusResponse>("/v1/kyc/tier1", { method: "POST", token, body: { nationalId } }),

  upgradeKycTier2: (token: string, proofOfAddressConfirmed: boolean) =>
    request<KycStatusResponse>("/v1/kyc/tier2", { method: "POST", token, body: { proofOfAddressConfirmed } }),

  createWallet: (token: string) => request<WalletCreateResponse>("/v1/wallets", { method: "POST", token }),

  cashIn: (token: string, walletId: string, body: CashInRequest) =>
    request<WalletActionResponse>(`/v1/wallets/${walletId}/cash-in`, { method: "POST", token, body }),

  cashOut: (token: string, walletId: string, body: CashOutRequest) =>
    request<WalletActionResponse>(`/v1/wallets/${walletId}/cash-out`, { method: "POST", token, body }),

  airtimeTopUp: (token: string, walletId: string, body: AirtimeTopUpRequest) =>
    request<WalletActionResponse>(`/v1/wallets/${walletId}/airtime-topup`, { method: "POST", token, body }),

  transactions: (token: string, walletId: string) =>
    request<WalletTransactionsResponse>(`/v1/wallets/${walletId}/transactions`, { token }),

  transferInternal: (token: string, body: InternalTransferRequest) =>
    request<InternalTransferResponse>("/v1/transfers/internal", { method: "POST", token, body }),

  transferMobileMoney: (token: string, body: MobileMoneyTransferRequest) =>
    request<MobileMoneyTransferResponse>("/v1/transfers/mobile-money", { method: "POST", token, body }),
};
