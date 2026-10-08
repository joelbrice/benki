import type { AdminAlert, AdminCase, RuleHit, StrReport } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { AlertRow, CaseRow, StaffRow, TransactionRow } from "../db/rows";
import { decryptField, randomDigits } from "../lib/crypto";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { newId } from "../lib/ids";
import { audit } from "./audit";
import { revokeAllSessions } from "./auth";
import { notify } from "./notifications";
import { requireUserRow } from "./users";

export function requireRole(staff: StaffRow, ...roles: StaffRow["role"][]) {
  if (!roles.includes(staff.role)) throw forbidden(`This action requires one of: ${roles.join(", ")}`);
}

export function raiseAlert(
  ctx: AppContext,
  input: { kind: AlertRow["kind"]; userId: string; transactionId: string | null; severity: AlertRow["severity"]; hits: RuleHit[] },
): string {
  return withTx(ctx.db, () => {
    const now = ctx.nowIso();
    let caseId = one<{ id: string }>(
      ctx.db,
      "SELECT id FROM cases WHERE user_id = ? AND status = 'OPEN' ORDER BY created_at LIMIT 1",
      input.userId,
    )?.id;
    if (!caseId) {
      caseId = newId("CASE");
      run(ctx.db, "INSERT INTO cases (id, user_id, status, created_at, updated_at) VALUES (?, ?, 'OPEN', ?, ?)", caseId, input.userId, now, now);
    } else {
      run(ctx.db, "UPDATE cases SET updated_at = ? WHERE id = ?", now, caseId);
    }
    const alertId = newId("ALR");
    run(
      ctx.db,
      `INSERT INTO alerts (id, kind, user_id, transaction_id, severity, rule_hits, status, case_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
      alertId,
      input.kind,
      input.userId,
      input.transactionId,
      input.severity,
      JSON.stringify(input.hits),
      caseId,
      now,
    );
    audit(ctx, {
      actorType: "SYSTEM",
      actorId: null,
      action: "ALERT_RAISED",
      entityType: "alert",
      entityId: alertId,
      details: { userId: input.userId, transactionId: input.transactionId, rules: input.hits.map((h) => h.code), caseId },
    });
    return alertId;
  });
}

export function closeAlertsForTransaction(ctx: AppContext, transactionId: string, resolution: string) {
  run(
    ctx.db,
    "UPDATE alerts SET status = 'CLOSED', resolution = ?, closed_at = ? WHERE transaction_id = ? AND status = 'OPEN'",
    resolution,
    ctx.nowIso(),
    transactionId,
  );
}

function phoneOf(ctx: AppContext, userId: string) {
  return one<{ phone: string }>(ctx.db, "SELECT phone FROM users WHERE id = ?", userId)?.phone ?? "";
}

export function toAdminAlert(ctx: AppContext, row: AlertRow): AdminAlert {
  return {
    alertId: row.id,
    kind: row.kind,
    userId: row.user_id,
    userPhone: phoneOf(ctx, row.user_id),
    transactionId: row.transaction_id,
    severity: row.severity,
    rules: JSON.parse(row.rule_hits),
    status: row.status,
    caseId: row.case_id,
    createdAt: row.created_at,
  };
}

export function listAlerts(ctx: AppContext, status?: string): AdminAlert[] {
  const rows = status
    ? all<AlertRow>(ctx.db, "SELECT * FROM alerts WHERE status = ? ORDER BY created_at DESC LIMIT 200", status)
    : all<AlertRow>(ctx.db, "SELECT * FROM alerts ORDER BY created_at DESC LIMIT 200");
  return rows.map((r) => toAdminAlert(ctx, r));
}

export function getCase(ctx: AppContext, caseId: string): AdminCase {
  const row = one<CaseRow>(ctx.db, "SELECT * FROM cases WHERE id = ?", caseId);
  if (!row) throw notFound("Case not found");
  const alerts = all<AlertRow>(ctx.db, "SELECT * FROM alerts WHERE case_id = ? ORDER BY created_at", caseId);
  const notes = all<{ username: string; note: string; created_at: string }>(
    ctx.db,
    `SELECT s.username, n.note, n.created_at FROM case_notes n JOIN staff s ON s.id = n.staff_id
     WHERE n.case_id = ? ORDER BY n.created_at`,
    caseId,
  );
  const str = one<{ id: string; reference: string; filed_by_username: string; payload: string; filed_at: string }>(
    ctx.db,
    `SELECT r.id, r.reference, r.payload, r.filed_at, s.username AS filed_by_username
     FROM str_reports r JOIN staff s ON s.id = r.filed_by WHERE r.case_id = ?`,
    caseId,
  );
  return {
    caseId: row.id,
    userId: row.user_id,
    userPhone: phoneOf(ctx, row.user_id),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    alerts: alerts.map((a) => toAdminAlert(ctx, a)),
    notes: notes.map((n) => ({ staffUsername: n.username, note: n.note, createdAt: n.created_at })),
    str: str
      ? {
          reportId: str.id,
          reference: str.reference,
          caseId,
          filedBy: str.filed_by_username,
          filedAt: str.filed_at,
          payload: JSON.parse(str.payload),
        }
      : null,
  };
}

export function listCases(ctx: AppContext, status?: string): AdminCase[] {
  const rows = status
    ? all<{ id: string }>(ctx.db, "SELECT id FROM cases WHERE status = ? ORDER BY updated_at DESC LIMIT 100", status)
    : all<{ id: string }>(ctx.db, "SELECT id FROM cases ORDER BY updated_at DESC LIMIT 100");
  return rows.map((r) => getCase(ctx, r.id));
}

export function addCaseNote(ctx: AppContext, caseId: string, staff: StaffRow, note: string) {
  if (!one(ctx.db, "SELECT id FROM cases WHERE id = ?", caseId)) throw notFound("Case not found");
  withTx(ctx.db, () => {
    run(ctx.db, "INSERT INTO case_notes (id, case_id, staff_id, note, created_at) VALUES (?, ?, ?, ?, ?)", newId("NOTE"), caseId, staff.id, note, ctx.nowIso());
    run(ctx.db, "UPDATE cases SET updated_at = ? WHERE id = ?", ctx.nowIso(), caseId);
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "CASE_NOTE_ADDED", entityType: "case", entityId: caseId });
  });
}

function assertNoUndecidedHolds(ctx: AppContext, caseId: string) {
  const undecided = one<{ n: number }>(
    ctx.db,
    `SELECT COUNT(*) AS n FROM alerts a JOIN transactions t ON t.id = a.transaction_id
     WHERE a.case_id = ? AND t.status = 'PENDING_REVIEW'`,
    caseId,
  );
  if (undecided && undecided.n > 0) throw conflict("Approve or reject the held transactions in this case first");
  const screening = one<{ n: number }>(
    ctx.db,
    "SELECT COUNT(*) AS n FROM alerts WHERE case_id = ? AND kind = 'SCREENING' AND status = 'OPEN'",
    caseId,
  );
  if (screening && screening.n > 0) throw conflict("Resolve the open screening alerts in this case first");
}

export function closeCase(ctx: AppContext, caseId: string, staff: StaffRow, resolution: string) {
  const row = one<CaseRow>(ctx.db, "SELECT * FROM cases WHERE id = ?", caseId);
  if (!row) throw notFound("Case not found");
  if (row.status !== "OPEN") throw conflict("Case is already closed");
  assertNoUndecidedHolds(ctx, caseId);
  withTx(ctx.db, () => {
    const now = ctx.nowIso();
    run(ctx.db, "UPDATE cases SET status = 'CLOSED_NO_ACTION', updated_at = ?, closed_by = ?, resolution = ? WHERE id = ?", now, staff.id, resolution, caseId);
    run(ctx.db, "UPDATE alerts SET status = 'CLOSED', resolution = COALESCE(resolution, ?), closed_at = ? WHERE case_id = ? AND status = 'OPEN'", "CASE_CLOSED_NO_ACTION", now, caseId);
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "CASE_CLOSED", entityType: "case", entityId: caseId, details: { resolution } });
  });
}

/**
 * Files a suspicious transaction report with the FIU (goAML-style payload).
 * Supervisor-only, and silent towards the customer: the subject is never
 * notified (no tipping off).
 */
export function fileStr(ctx: AppContext, caseId: string, staff: StaffRow, narrative: string): StrReport {
  requireRole(staff, "SUPERVISOR", "ADMIN");
  if (narrative.trim().length < 30) throw badRequest("The STR narrative must explain the grounds for suspicion (30+ characters)");
  const row = one<CaseRow>(ctx.db, "SELECT * FROM cases WHERE id = ?", caseId);
  if (!row) throw notFound("Case not found");
  if (row.status !== "OPEN") throw conflict("Case is already closed");
  assertNoUndecidedHolds(ctx, caseId);

  const user = requireUserRow(ctx, row.user_id);
  const alerts = all<AlertRow>(ctx.db, "SELECT * FROM alerts WHERE case_id = ?", caseId);
  const since = new Date(ctx.now().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const transactions = all<TransactionRow>(
    ctx.db,
    `SELECT * FROM transactions WHERE (initiator_user_id = ? OR counterparty_user_id = ?)
     AND (created_at >= ? OR id IN (SELECT transaction_id FROM alerts WHERE case_id = ?))
     ORDER BY created_at`,
    user.id,
    user.id,
    since,
    caseId,
  );
  const filedAt = ctx.nowIso();
  const reference = `STR-${user.country_code}-${filedAt.slice(0, 10).replace(/-/g, "")}-${randomDigits(6)}`;
  const payload = {
    reportType: "STR",
    reference,
    reportingEntity: { name: "Benki (sandbox)", country: user.country_code },
    subject: {
      userId: user.id,
      fullName: user.full_name,
      dateOfBirth: user.date_of_birth,
      phone: user.phone,
      nationalId: user.national_id_enc ? decryptField(ctx.config.dataKey, user.national_id_enc) : null,
      country: user.country_code,
      kycTier: user.kyc_tier,
      accountStatus: user.status,
    },
    indicators: alerts.flatMap((a) => (JSON.parse(a.rule_hits) as RuleHit[]).map((h) => ({ code: h.code, description: h.description, alertId: a.id }))),
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      status: t.status,
      amountMinor: t.amount_minor,
      currency: t.currency,
      counterparty: t.counterparty_label,
      createdAt: t.created_at,
    })),
    narrative: narrative.trim(),
    filedBy: staff.username,
    filedAt,
  };
  const reportId = newId("STR");
  withTx(ctx.db, () => {
    run(ctx.db, "INSERT INTO str_reports (id, case_id, reference, filed_by, payload, filed_at) VALUES (?, ?, ?, ?, ?, ?)", reportId, caseId, reference, staff.id, JSON.stringify(payload), filedAt);
    run(ctx.db, "UPDATE cases SET status = 'CLOSED_STR_FILED', updated_at = ?, closed_by = ?, resolution = ? WHERE id = ?", filedAt, staff.id, `STR filed: ${reference}`, caseId);
    run(ctx.db, "UPDATE alerts SET status = 'CLOSED', resolution = COALESCE(resolution, 'STR_FILED'), closed_at = ? WHERE case_id = ? AND status = 'OPEN'", filedAt, caseId);
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "STR_FILED", entityType: "case", entityId: caseId, details: { reference } });
  });
  return { reportId, reference, caseId, filedBy: staff.username, filedAt, payload };
}

/** Immediate containment — any staff member can freeze; unfreezing needs four-eyes approval. */
export function freezeUser(ctx: AppContext, userId: string, staff: StaffRow, reason: string) {
  const user = requireUserRow(ctx, userId);
  if (user.status === "FROZEN") throw conflict("Account is already frozen");
  if (reason.trim().length < 10) throw badRequest("Give a reason for the freeze (10+ characters)");
  withTx(ctx.db, () => {
    run(ctx.db, "UPDATE users SET status = 'FROZEN' WHERE id = ?", userId);
    revokeAllSessions(ctx, userId);
    notify(ctx, userId, "ACCOUNT", "Your account has been restricted. Please contact support.");
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "USER_FROZEN", entityType: "user", entityId: userId, details: { reason } });
  });
}

export function unfreezeUser(ctx: AppContext, userId: string, staffId: string) {
  const user = requireUserRow(ctx, userId);
  if (user.status !== "FROZEN") throw conflict("Account is not frozen");
  if (user.screening_status === "CONFIRMED_MATCH") throw forbidden("A confirmed sanctions match can't be unfrozen");
  run(ctx.db, "UPDATE users SET status = 'ACTIVE' WHERE id = ?", userId);
  notify(ctx, userId, "ACCOUNT", "Your account restrictions have been lifted.");
  audit(ctx, { actorType: "STAFF", actorId: staffId, action: "USER_UNFROZEN", entityType: "user", entityId: userId });
}
