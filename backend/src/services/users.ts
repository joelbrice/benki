import type { UserProfile, WalletAccount } from "@benki/shared";
import type { AppContext } from "../context";
import { all, one, run } from "../db/query";
import type { UserRow } from "../db/rows";
import { accountRestricted, notFound } from "../lib/errors";
import { activeHoldsOf, balanceOf } from "./ledger";

export function getUser(ctx: AppContext, id: string): UserRow | undefined {
  return one<UserRow>(ctx.db, "SELECT * FROM users WHERE id = ?", id);
}

export function getUserByPhone(ctx: AppContext, phone: string): UserRow | undefined {
  return one<UserRow>(ctx.db, "SELECT * FROM users WHERE phone = ? AND kind = 'CUSTOMER'", phone);
}

export function requireUserRow(ctx: AppContext, id: string): UserRow {
  const user = getUser(ctx, id);
  if (!user) throw notFound("User not found");
  return user;
}

export function assertActive(user: UserRow) {
  if (user.status !== "ACTIVE") throw accountRestricted();
}

export function touchActivity(ctx: AppContext, userId: string) {
  run(ctx.db, "UPDATE users SET last_activity_at = ? WHERE id = ?", ctx.nowIso(), userId);
}

export function maskPhone(phone: string): string {
  return phone.length > 6 ? `${phone.slice(0, 4)}•••${phone.slice(-3)}` : "•••";
}

export function toUserProfile(user: UserRow): UserProfile {
  return {
    userId: user.id,
    phoneNumber: user.phone,
    countryCode: user.country_code,
    status: user.status,
    kycTier: user.kyc_tier,
    kycReviewPending: !!user.kyc_review_pending,
    walletId: user.wallet_account_id,
    fullName: user.full_name,
    dateOfBirth: user.date_of_birth,
    nationalIdMasked: user.national_id_last4 ? `••••${user.national_id_last4}` : null,
    proofOfAddressConfirmed: !!user.proof_of_address,
    pinSet: !!user.pin_hash,
    createdAt: user.created_at,
  };
}

export function walletView(ctx: AppContext, accountId: string): WalletAccount {
  const account = one<{ id: string; owner_id: string; currency: string }>(
    ctx.db,
    "SELECT id, owner_id, currency FROM accounts WHERE id = ?",
    accountId,
  );
  if (!account) throw notFound("Wallet not found");
  const ledger = balanceOf(ctx, accountId);
  const reserved = activeHoldsOf(ctx, accountId);
  const pending = one<{ total: number | null }>(
    ctx.db,
    "SELECT SUM(amount_minor + fee_minor) AS total FROM transactions WHERE source_account_id = ? AND status = 'PENDING'",
    accountId,
  );
  return {
    walletId: account.id,
    ownerUserId: account.owner_id,
    currency: account.currency,
    ledgerBalanceMinor: ledger,
    availableBalanceMinor: ledger - reserved,
    reservedBalanceMinor: reserved,
    pendingBalanceMinor: pending?.total ?? 0,
  };
}

/** Wallet + savings vaults: what the e-money balance cap applies to. */
export function totalHoldings(ctx: AppContext, userId: string): number {
  const rows = all<{ id: string }>(
    ctx.db,
    "SELECT id FROM accounts WHERE owner_id = ? AND kind IN ('WALLET', 'VAULT')",
    userId,
  );
  return rows.reduce((sum, r) => sum + balanceOf(ctx, r.id), 0);
}
