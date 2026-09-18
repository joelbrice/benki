// Mirrors packages/shared/src/index.ts. Duplicated here (rather than imported
// as a workspace package) to keep Metro's module resolution simple for the
// Expo app — see mobile/README.md for the tradeoff.

export type KycTier = "TIER_0" | "TIER_1" | "TIER_2";

export type JourneyStep = "ONBOARDING" | "KYC" | "WALLET" | "TRANSFER" | "HISTORY";

export type TransactionType = "CASH_IN" | "TRANSFER_OUT" | "TRANSFER_IN";

export type TransferStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export interface UserProfile {
  userId: string;
  phoneNumber: string;
  country: string;
  kycTier: KycTier;
  walletId: string | null;
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

export interface OtpSendResponse {
  requestId: string;
  devOtp: string;
}

export interface OtpVerifyResponse {
  token: string;
  user: UserProfile;
}

export interface KycStatusResponse {
  kycTier: KycTier;
}

export interface WalletCreateResponse {
  wallet: WalletAccount;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransaction[];
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

export const KYC_TIER_TRANSFER_LIMITS_MINOR: Record<KycTier, number> = {
  TIER_0: 20_000,
  TIER_1: 500_000,
  TIER_2: 5_000_000,
};
