import type {
  ApiErrorBody,
  InternalTransferRequest,
  InternalTransferResponse,
  KycStatusResponse,
  KycTier,
  OtpSendResponse,
  OtpVerifyResponse,
  WalletAccount,
  WalletCreateResponse,
  WalletTransaction,
  WalletTransactionsResponse,
} from "@benki/shared";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

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
  sendOtp: (phoneNumber: string, country: string) =>
    request<OtpSendResponse>("/v1/auth/otp/send", { method: "POST", body: { phoneNumber, country } }),

  verifyOtp: (phoneNumber: string, otp: string) =>
    request<OtpVerifyResponse>("/v1/auth/otp/verify", { method: "POST", body: { phoneNumber, otp } }),

  kycStatus: (token: string) => request<KycStatusResponse>("/v1/kyc/status", { token }),

  upgradeKyc: (token: string, tier: Extract<KycTier, "TIER_1" | "TIER_2">) =>
    request<KycStatusResponse>(`/v1/kyc/${tier === "TIER_1" ? "tier1" : "tier2"}`, {
      method: "POST",
      token,
    }),

  createWallet: (token: string) => request<WalletCreateResponse>("/v1/wallets", { method: "POST", token }),

  cashIn: (token: string, walletId: string, amountMinor: number) =>
    request<{ wallet: WalletAccount; transaction: WalletTransaction }>(
      `/v1/wallets/${walletId}/cash-in`,
      { method: "POST", token, body: { amountMinor } },
    ),

  transactions: (token: string, walletId: string) =>
    request<WalletTransactionsResponse>(`/v1/wallets/${walletId}/transactions`, { token }),

  transferInternal: (token: string, body: InternalTransferRequest) =>
    request<InternalTransferResponse>("/v1/transfers/internal", { method: "POST", token, body }),
};
