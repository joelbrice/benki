import type { Approval, ApprovalAction } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { ApprovalRow, StaffRow } from "../db/rows";
import { ApiError, badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { audit } from "./audit";
import { requireRole, unfreezeUser } from "./compliance";
import { notify } from "./notifications";
import { assertReversible, getTransaction, manualAdjustment, reverseTransaction } from "./payments";
import { requireUserRow } from "./users";

const MAX_ADJUSTMENT_MINOR = 100_000_000;

function toApproval(ctx: AppContext, row: ApprovalRow): Approval {
  const name = (id: string | null) => (id ? (one<{ username: string }>(ctx.db, "SELECT username FROM staff WHERE id = ?", id)?.username ?? id) : null);
  return {
    approvalId: row.id,
    action: row.action,
    payload: JSON.parse(row.payload),
    reason: row.reason,
    status: row.status,
    requestedBy: name(row.requested_by)!,
    requestedAt: row.requested_at,
    decidedBy: name(row.decided_by),
    decidedAt: row.decided_at,
    failureReason: row.failure_reason,
  };
}

export function listApprovals(ctx: AppContext, status?: string): Approval[] {
  const rows = status
    ? all<ApprovalRow>(ctx.db, "SELECT * FROM approvals WHERE status = ? ORDER BY requested_at DESC LIMIT 100", status)
    : all<ApprovalRow>(ctx.db, "SELECT * FROM approvals ORDER BY requested_at DESC LIMIT 100");
  return rows.map((r) => toApproval(ctx, r));
}

/** Maker step: records a sensitive action for a second person to approve. */
export function requestApproval(
  ctx: AppContext,
  staff: StaffRow,
  action: ApprovalAction,
  payload: Record<string, unknown>,
  reason: string,
): Approval {
  if (reason.trim().length < 10) throw badRequest("Explain why this is needed (10+ characters)");
  if (action === "REVERSAL") {
    const transactionId = String(payload.transactionId ?? "");
    assertReversible(getTransaction(ctx, transactionId));
    const open = one(ctx.db, "SELECT id FROM approvals WHERE action = 'REVERSAL' AND status = 'PENDING' AND json_extract(payload, '$.transactionId') = ?", transactionId);
    if (open) throw conflict("A reversal for this transaction is already awaiting approval");
  } else if (action === "UNFREEZE") {
    const user = requireUserRow(ctx, String(payload.userId ?? ""));
    if (user.status !== "FROZEN") throw conflict("Account is not frozen");
    if (user.screening_status === "CONFIRMED_MATCH") throw forbidden("A confirmed sanctions match can't be unfrozen");
  } else if (action === "MANUAL_ADJUSTMENT") {
    const user = requireUserRow(ctx, String(payload.userId ?? ""));
    if (!user.wallet_account_id) throw badRequest("Customer has no wallet");
    const delta = Number(payload.amountMinor);
    if (!Number.isSafeInteger(delta) || delta === 0) throw badRequest("amountMinor must be a non-zero whole number");
    if (Math.abs(delta) > MAX_ADJUSTMENT_MINOR) throw badRequest("Adjustment exceeds the single-adjustment cap");
  }
  return withTx(ctx.db, () => {
    const id = newId("APR");
    run(
      ctx.db,
      "INSERT INTO approvals (id, action, payload, reason, status, requested_by, requested_at) VALUES (?, ?, ?, ?, 'PENDING', ?, ?)",
      id,
      action,
      JSON.stringify(payload),
      reason.trim(),
      staff.id,
      ctx.nowIso(),
    );
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "APPROVAL_REQUESTED", entityType: "approval", entityId: id, details: { action, payload } });
    return toApproval(ctx, one<ApprovalRow>(ctx.db, "SELECT * FROM approvals WHERE id = ?", id)!);
  });
}

function execute(ctx: AppContext, row: ApprovalRow, approver: StaffRow) {
  const payload = JSON.parse(row.payload) as Record<string, unknown>;
  switch (row.action) {
    case "REVERSAL": {
      reverseTransaction(ctx, String(payload.transactionId), approver.id, row.reason);
      if (payload.disputeId) {
        run(
          ctx.db,
          "UPDATE disputes SET status = 'RESOLVED_REVERSED', resolved_at = ?, resolution = ? WHERE id = ?",
          ctx.nowIso(),
          "Payment reversed",
          String(payload.disputeId),
        );
        const dispute = one<{ user_id: string }>(ctx.db, "SELECT user_id FROM disputes WHERE id = ?", String(payload.disputeId));
        if (dispute) notify(ctx, dispute.user_id, "TRANSACTION", "Your dispute was upheld and the payment has been reversed.");
      }
      return;
    }
    case "UNFREEZE":
      unfreezeUser(ctx, String(payload.userId), approver.id);
      return;
    case "MANUAL_ADJUSTMENT":
      manualAdjustment(ctx, String(payload.userId), Number(payload.amountMinor), row.reason, approver.id);
      return;
  }
}

/** Checker step: a *different* supervisor approves or rejects. */
export function decideApproval(ctx: AppContext, staff: StaffRow, approvalId: string, approve: boolean, note = ""): Approval {
  requireRole(staff, "SUPERVISOR", "ADMIN");
  const row = one<ApprovalRow>(ctx.db, "SELECT * FROM approvals WHERE id = ?", approvalId);
  if (!row) throw notFound("Approval not found");
  if (row.status !== "PENDING") throw conflict("This request has already been decided");
  if (row.requested_by === staff.id) throw forbidden("Four-eyes rule: someone other than the requester must decide");

  const finish = (status: ApprovalRow["status"], failure: string | null) => {
    run(
      ctx.db,
      "UPDATE approvals SET status = ?, decided_by = ?, decided_at = ?, failure_reason = ? WHERE id = ?",
      status,
      staff.id,
      ctx.nowIso(),
      failure,
      approvalId,
    );
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: `APPROVAL_${status}`, entityType: "approval", entityId: approvalId, details: { note, failure } });
  };

  if (!approve) {
    withTx(ctx.db, () => {
      finish("REJECTED", null);
      const payload = JSON.parse(row.payload) as { disputeId?: string };
      if (payload.disputeId) run(ctx.db, "UPDATE disputes SET approval_id = NULL WHERE id = ?", payload.disputeId);
    });
  } else {
    try {
      withTx(ctx.db, () => {
        execute(ctx, row, staff);
        finish("APPROVED", null);
      });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      withTx(ctx.db, () => {
        finish("FAILED", error.message);
        const payload = JSON.parse(row.payload) as { disputeId?: string };
        if (payload.disputeId) run(ctx.db, "UPDATE disputes SET approval_id = NULL WHERE id = ?", payload.disputeId);
      });
    }
  }
  return toApproval(ctx, one<ApprovalRow>(ctx.db, "SELECT * FROM approvals WHERE id = ?", approvalId)!);
}
