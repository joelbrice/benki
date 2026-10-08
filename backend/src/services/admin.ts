import type { AdminDashboard, AdminTransaction, AdminUserView, TransactionStatus, TransactionType } from "@benki/shared";
import type { AppContext } from "../context";
import { all, one } from "../db/query";
import type { AlertRow, StaffRow, TransactionRow, UserRow } from "../db/rows";
import { decryptField } from "../lib/crypto";
import { notFound } from "../lib/errors";
import { audit } from "./audit";
import { toAdminAlert } from "./compliance";
import { balanceOf } from "./ledger";
import { currencyOf } from "./limits";
import { toAdminTransaction } from "./views";

const count = (ctx: AppContext, sql: string, ...params: string[]) => one<{ n: number }>(ctx.db, sql, ...params)?.n ?? 0;

export function dashboard(ctx: AppContext): AdminDashboard {
  return {
    users: count(ctx, "SELECT COUNT(*) AS n FROM users WHERE kind = 'CUSTOMER'"),
    frozenUsers: count(ctx, "SELECT COUNT(*) AS n FROM users WHERE status = 'FROZEN'"),
    openAlerts: count(ctx, "SELECT COUNT(*) AS n FROM alerts WHERE status = 'OPEN'"),
    openCases: count(ctx, "SELECT COUNT(*) AS n FROM cases WHERE status = 'OPEN'"),
    pendingReview: count(ctx, "SELECT COUNT(*) AS n FROM transactions WHERE status = 'PENDING_REVIEW'"),
    pendingApprovals: count(ctx, "SELECT COUNT(*) AS n FROM approvals WHERE status = 'PENDING'"),
    pendingProviderPayouts: count(ctx, "SELECT COUNT(*) AS n FROM transactions WHERE status = 'PENDING'"),
    openDisputes: count(ctx, "SELECT COUNT(*) AS n FROM disputes WHERE status = 'OPEN'"),
    volumeByType: all<{ type: TransactionType; currency: string; count: number; amount: number }>(
      ctx.db,
      `SELECT type, currency, COUNT(*) AS count, SUM(amount_minor) AS amount FROM transactions
       WHERE status = 'COMPLETED' GROUP BY type, currency ORDER BY currency, type`,
    ).map((r) => ({ type: r.type, currency: r.currency, count: r.count, amountMinor: r.amount })),
    statusCounts: all<{ status: TransactionStatus; count: number }>(
      ctx.db,
      "SELECT status, COUNT(*) AS count FROM transactions GROUP BY status ORDER BY status",
    ),
  };
}

export function listTransactions(ctx: AppContext, status?: string, userId?: string): AdminTransaction[] {
  const where: string[] = [];
  const params: string[] = [];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (userId) {
    where.push("(initiator_user_id = ? OR counterparty_user_id = ?)");
    params.push(userId, userId);
  }
  return all<TransactionRow>(
    ctx.db,
    `SELECT * FROM transactions ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC, rowid DESC LIMIT 200`,
    ...params,
  ).map((t) => toAdminTransaction(ctx, t));
}

export function searchUsers(ctx: AppContext, query: string) {
  const like = `%${query.trim()}%`;
  return all<UserRow>(
    ctx.db,
    `SELECT * FROM users WHERE kind = 'CUSTOMER' AND (phone LIKE ? OR full_name LIKE ? OR id = ?)
     ORDER BY created_at DESC LIMIT 25`,
    like,
    like,
    query.trim(),
  ).map((u) => ({
    userId: u.id,
    phoneNumber: u.phone,
    fullName: u.full_name,
    countryCode: u.country_code,
    status: u.status,
    kycTier: u.kyc_tier,
    screeningStatus: u.screening_status,
  }));
}

/**
 * Customer 360 view for investigators. Viewing it is itself audited (PII
 * access logging), and the national ID is only decrypted for supervisors.
 */
export function userView(ctx: AppContext, userId: string, staff: StaffRow): AdminUserView {
  const user = one<UserRow>(ctx.db, "SELECT * FROM users WHERE id = ?", userId);
  if (!user) throw notFound("User not found");
  const canSeeId = staff.role !== "ANALYST";
  audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "CUSTOMER_RECORD_VIEWED", entityType: "user", entityId: userId, details: { nationalIdRevealed: canSeeId } });
  return {
    userId: user.id,
    phoneNumber: user.phone,
    countryCode: user.country_code,
    status: user.status,
    kycTier: user.kyc_tier,
    fullName: user.full_name,
    dateOfBirth: user.date_of_birth,
    nationalId: user.national_id_enc
      ? canSeeId
        ? decryptField(ctx.config.dataKey, user.national_id_enc)
        : `••••${user.national_id_last4}`
      : null,
    screeningStatus: user.screening_status,
    screeningMatches: JSON.parse(user.screening_matches),
    pinLocked: !!user.pin_locked_until && new Date(user.pin_locked_until) > ctx.now(),
    createdAt: user.created_at,
    lastActivityAt: user.last_activity_at,
    devices: all<{ device_id: string; first_seen_at: string; last_seen_at: string }>(
      ctx.db,
      "SELECT device_id, first_seen_at, last_seen_at FROM devices WHERE user_id = ? ORDER BY first_seen_at",
      userId,
    ).map((d) => ({ deviceId: d.device_id, firstSeenAt: d.first_seen_at, lastSeenAt: d.last_seen_at })),
    walletBalanceMinor: user.wallet_account_id ? balanceOf(ctx, user.wallet_account_id) : null,
    currency: currencyOf(user),
    transactions: listTransactions(ctx, undefined, userId),
    alerts: all<AlertRow>(ctx.db, "SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC", userId).map((a) => toAdminAlert(ctx, a)),
  };
}
