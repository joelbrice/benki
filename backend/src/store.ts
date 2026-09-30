import { randomUUID } from "crypto";
import type {
  InternalTransferResponse,
  UserProfile,
  WalletAccount,
  WalletTransaction,
} from "@benki/shared";

/**
 * In-memory data store for the mock backend. Resets on every restart — this
 * is a vertical-slice demo of the ledger model in
 * docs/LEDGER_RECONCILIATION_SPEC.md, not a persistence layer.
 */

export const usersByPhone = new Map<string, UserProfile>();
export const usersById = new Map<string, UserProfile>();
export const wallets = new Map<string, WalletAccount>();
export const transactionsByWallet = new Map<string, WalletTransaction[]>();
export const tokens = new Map<string, string>(); // token -> userId
export const otpByPhone = new Map<string, { otp: string; expiresAt: number }>();
export const idempotencyCache = new Map<string, InternalTransferResponse>();

export function createUser(phoneNumber: string, countryCode: string): UserProfile {
  const user: UserProfile = {
    userId: `USER-${randomUUID()}`,
    phoneNumber,
    countryCode,
    kycTier: "TIER_0",
    walletId: null,
    nationalId: null,
    proofOfAddressConfirmed: false,
  };
  usersByPhone.set(phoneNumber, user);
  usersById.set(user.userId, user);
  return user;
}

export function requireUserByToken(token: string | undefined): UserProfile {
  if (!token) throw new AuthTokenMissingError();
  const userId = tokens.get(token);
  if (!userId) throw new AuthTokenMissingError();
  const user = usersById.get(userId);
  if (!user) throw new AuthTokenMissingError();
  return user;
}

export class AuthTokenMissingError extends Error {}

export function appendTransaction(tx: WalletTransaction) {
  const list = transactionsByWallet.get(tx.walletId) ?? [];
  list.unshift(tx); // newest first
  transactionsByWallet.set(tx.walletId, list);
}
