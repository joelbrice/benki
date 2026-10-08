import type { AdminDispute, Dispute } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { DisputeRow, StaffRow, UserRow } from "../db/rows";
import { badRequest, conflict, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { requestApproval } from "./approvals";
import { audit } from "./audit";
import { notify } from "./notifications";
import { getTransaction } from "./payments";
import { DISPUTABLE_TYPES, DISPUTE_WINDOW_DAYS, toAdminTransaction } from "./views";

function toDispute(row: DisputeRow): Dispute {
  return {
    disputeId: row.id,
    transactionId: row.transaction_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    resolution: row.resolution,
  };
}

export function openDispute(ctx: AppContext, user: UserRow, transactionId: string, reason: string): Dispute {
  const tx = getTransaction(ctx, transactionId);
  if (!tx || tx.initiator_user_id !== user.id) throw notFound("Transaction not found");
  if (tx.status !== "COMPLETED" || !DISPUTABLE_TYPES.has(tx.type)) throw badRequest("This transaction can't be disputed");
  const ageDays = (ctx.now().getTime() - new Date(tx.created_at).getTime()) / 86_400_000;
  if (ageDays > DISPUTE_WINDOW_DAYS) throw badRequest(`Disputes must be raised within ${DISPUTE_WINDOW_DAYS} days`);
  if (one(ctx.db, "SELECT id FROM disputes WHERE transaction_id = ?", transactionId)) throw conflict("You've already disputed this transaction");
  const trimmed = reason.trim();
  if (trimmed.length < 10) throw badRequest("Tell us what went wrong (10+ characters)");

  return withTx(ctx.db, () => {
    const id = newId("DSP");
    run(
      ctx.db,
      "INSERT INTO disputes (id, transaction_id, user_id, reason, status, created_at) VALUES (?, ?, ?, ?, 'OPEN', ?)",
      id,
      transactionId,
      user.id,
      trimmed,
      ctx.nowIso(),
    );
    notify(ctx, user.id, "TRANSACTION", `We received your dispute for ${transactionId}. We'll update you within 10 working days.`);
    audit(ctx, { actorType: "USER", actorId: user.id, action: "DISPUTE_OPENED", entityType: "dispute", entityId: id, details: { transactionId } });
    return toDispute(one<DisputeRow>(ctx.db, "SELECT * FROM disputes WHERE id = ?", id)!);
  });
}

export function listUserDisputes(ctx: AppContext, userId: string): Dispute[] {
  return all<DisputeRow>(ctx.db, "SELECT * FROM disputes WHERE user_id = ? ORDER BY created_at DESC", userId).map(toDispute);
}

export function listAllDisputes(ctx: AppContext, status?: string): AdminDispute[] {
  const rows = status
    ? all<DisputeRow>(ctx.db, "SELECT * FROM disputes WHERE status = ? ORDER BY created_at DESC LIMIT 100", status)
    : all<DisputeRow>(ctx.db, "SELECT * FROM disputes ORDER BY created_at DESC LIMIT 100");
  return rows.map((d) => {
    const tx = getTransaction(ctx, d.transaction_id);
    const user = one<{ phone: string }>(ctx.db, "SELECT phone FROM users WHERE id = ?", d.user_id);
    return { ...toDispute(d), userId: d.user_id, userPhone: user?.phone ?? "", transaction: tx ? toAdminTransaction(ctx, tx) : null };
  });
}

function requireOpenDispute(ctx: AppContext, disputeId: string): DisputeRow {
  const row = one<DisputeRow>(ctx.db, "SELECT * FROM disputes WHERE id = ?", disputeId);
  if (!row) throw notFound("Dispute not found");
  if (row.status !== "OPEN") throw conflict("Dispute is already resolved");
  if (row.approval_id) throw conflict("A reversal for this dispute is already awaiting approval");
  return row;
}

export function rejectDispute(ctx: AppContext, staff: StaffRow, disputeId: string, resolution: string) {
  const row = requireOpenDispute(ctx, disputeId);
  if (resolution.trim().length < 10) throw badRequest("Explain the outcome to the customer (10+ characters)");
  withTx(ctx.db, () => {
    run(ctx.db, "UPDATE disputes SET status = 'RESOLVED_REJECTED', resolved_at = ?, resolution = ? WHERE id = ?", ctx.nowIso(), resolution.trim(), disputeId);
    notify(ctx, row.user_id, "TRANSACTION", `Update on your dispute for ${row.transaction_id}: ${resolution.trim()}`);
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "DISPUTE_REJECTED", entityType: "dispute", entityId: disputeId });
  });
}

/** Upholding a dispute routes through four-eyes approval before money moves back. */
export function requestDisputeReversal(ctx: AppContext, staff: StaffRow, disputeId: string, reason: string) {
  const row = requireOpenDispute(ctx, disputeId);
  return withTx(ctx.db, () => {
    const approval = requestApproval(ctx, staff, "REVERSAL", { transactionId: row.transaction_id, disputeId }, reason);
    run(ctx.db, "UPDATE disputes SET approval_id = ? WHERE id = ?", approval.approvalId, disputeId);
    return approval;
  });
}
