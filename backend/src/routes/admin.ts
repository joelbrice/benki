import { Router } from "express";
import { z } from "zod";
import type { AppContext } from "../context";
import { requireStaff, bearerToken } from "../http/auth";
import { asyncHandler, rateLimit } from "../http/middleware";
import { parse } from "../lib/validation";
import { dashboard, listTransactions, searchUsers, userView } from "../services/admin";
import { decideApproval, listApprovals, requestApproval } from "../services/approvals";
import { listAudit, verifyAuditChain } from "../services/audit";
import { addCaseNote, closeCase, fileStr, freezeUser, getCase, listAlerts, listCases } from "../services/compliance";
import { listAllDisputes, rejectDispute, requestDisputeReversal } from "../services/disputes";
import { resolveScreeningAlert } from "../services/kyc";
import { trialBalance } from "../services/ledger";
import { approveHeldTransaction, rejectHeldTransaction } from "../services/payments";
import { listReconciliationExceptions, listReconciliationRuns, runReconciliation } from "../services/reconciliation";
import { dispatchPayout, runSettlementOnce } from "../services/settlement";
import { staffLogin, staffLogout } from "../services/staff";
import { toAdminTransaction } from "../services/views";

const text = (min: number, max = 2000) => z.string().trim().min(min).max(max);

export function adminRoutes(ctx: AppContext): Router {
  const router = Router();
  const staff = requireStaff(ctx);
  const supervisors = requireStaff(ctx, "SUPERVISOR", "ADMIN");

  router.post("/login", rateLimit(ctx, "staff-login", 10, 60_000), (req, res) => {
    const body = parse(z.object({ username: text(1, 64), password: z.string().min(1).max(200) }), req.body);
    res.json(staffLogin(ctx, body.username, body.password));
  });
  router.post("/logout", staff, (req, res) => {
    staffLogout(ctx, bearerToken(req)!);
    res.status(204).end();
  });
  router.get("/me", staff, (req, res) => {
    const s = req.staff!;
    res.json({ staffId: s.id, username: s.username, role: s.role });
  });
  router.get("/dashboard", staff, (_req, res) => {
    res.json(dashboard(ctx));
  });

  // Alerts & cases
  router.get("/alerts", staff, (req, res) => {
    res.json({ alerts: listAlerts(ctx, typeof req.query.status === "string" ? req.query.status : undefined) });
  });
  router.post("/alerts/:alertId/screening", staff, (req, res) => {
    const body = parse(z.object({ decision: z.enum(["CLEAR", "CONFIRM"]), note: text(10) }), req.body);
    resolveScreeningAlert(ctx, req.params.alertId, req.staff!, body.decision, body.note);
    res.status(204).end();
  });
  router.get("/cases", staff, (req, res) => {
    res.json({ cases: listCases(ctx, typeof req.query.status === "string" ? req.query.status : undefined) });
  });
  router.get("/cases/:caseId", staff, (req, res) => {
    res.json({ case: getCase(ctx, req.params.caseId) });
  });
  router.post("/cases/:caseId/notes", staff, (req, res) => {
    const body = parse(z.object({ note: text(3) }), req.body);
    addCaseNote(ctx, req.params.caseId, req.staff!, body.note);
    res.status(201).json({ case: getCase(ctx, req.params.caseId) });
  });
  router.post("/cases/:caseId/close", staff, (req, res) => {
    const body = parse(z.object({ resolution: text(10) }), req.body);
    closeCase(ctx, req.params.caseId, req.staff!, body.resolution);
    res.json({ case: getCase(ctx, req.params.caseId) });
  });
  router.post("/cases/:caseId/str", supervisors, (req, res) => {
    const body = parse(z.object({ narrative: text(30, 5000) }), req.body);
    res.status(201).json({ str: fileStr(ctx, req.params.caseId, req.staff!, body.narrative) });
  });

  // Transactions held for review
  router.get("/transactions", staff, (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
    res.json({ transactions: listTransactions(ctx, status, userId) });
  });
  // Releasing held funds is a supervisor decision; any analyst may reject.
  router.post(
    "/transactions/:transactionId/approve",
    supervisors,
    asyncHandler(async (req, res) => {
      const { tx, needsDispatch } = approveHeldTransaction(ctx, req.params.transactionId, req.staff!);
      const final = needsDispatch ? await dispatchPayout(ctx, tx.id) : tx;
      res.json({ transaction: toAdminTransaction(ctx, final) });
    }),
  );
  router.post("/transactions/:transactionId/reject", staff, (req, res) => {
    const body = parse(z.object({ reason: text(10) }), req.body);
    res.json({ transaction: toAdminTransaction(ctx, rejectHeldTransaction(ctx, req.params.transactionId, req.staff!, body.reason)) });
  });

  // Customers
  router.get("/users", staff, (req, res) => {
    res.json({ users: searchUsers(ctx, String(req.query.query ?? "")) });
  });
  router.get("/users/:userId", staff, (req, res) => {
    res.json({ user: userView(ctx, req.params.userId, req.staff!) });
  });
  router.post("/users/:userId/freeze", staff, (req, res) => {
    const body = parse(z.object({ reason: text(10) }), req.body);
    freezeUser(ctx, req.params.userId, req.staff!, body.reason);
    res.status(204).end();
  });

  // Four-eyes approvals
  router.get("/approvals", staff, (req, res) => {
    res.json({ approvals: listApprovals(ctx, typeof req.query.status === "string" ? req.query.status : undefined) });
  });
  router.post("/approvals", staff, (req, res) => {
    const body = parse(
      z.object({
        action: z.enum(["REVERSAL", "UNFREEZE", "MANUAL_ADJUSTMENT"]),
        payload: z.record(z.unknown()),
        reason: text(10),
      }),
      req.body,
    );
    res.status(201).json({ approval: requestApproval(ctx, req.staff!, body.action, body.payload, body.reason) });
  });
  for (const decision of ["approve", "reject"] as const) {
    router.post(`/approvals/:approvalId/${decision}`, supervisors, (req, res) => {
      const body = parse(z.object({ note: z.string().max(500).optional() }), req.body);
      res.json({ approval: decideApproval(ctx, req.staff!, req.params.approvalId, decision === "approve", body.note) });
    });
  }

  // Disputes
  router.get("/disputes", staff, (req, res) => {
    res.json({ disputes: listAllDisputes(ctx, typeof req.query.status === "string" ? req.query.status : undefined) });
  });
  router.post("/disputes/:disputeId/reject", staff, (req, res) => {
    const body = parse(z.object({ resolution: text(10) }), req.body);
    rejectDispute(ctx, req.staff!, req.params.disputeId, body.resolution);
    res.status(204).end();
  });
  router.post("/disputes/:disputeId/request-reversal", staff, (req, res) => {
    const body = parse(z.object({ reason: text(10) }), req.body);
    res.status(201).json({ approval: requestDisputeReversal(ctx, req.staff!, req.params.disputeId, body.reason) });
  });

  // Ledger integrity, audit, settlement, reconciliation
  router.get("/ledger/trial-balance", staff, (_req, res) => {
    res.json(trialBalance(ctx));
  });
  router.get("/audit", supervisors, (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    res.json({ entries: listAudit(ctx, limit, typeof req.query.entityId === "string" ? req.query.entityId : undefined) });
  });
  router.get("/audit/verify", supervisors, (_req, res) => {
    res.json(verifyAuditChain(ctx));
  });
  router.post(
    "/settlement/run",
    staff,
    asyncHandler(async (_req, res) => {
      res.json(await runSettlementOnce(ctx));
    }),
  );
  router.post(
    "/reconciliation/run",
    staff,
    asyncHandler(async (req, res) => {
      res.status(201).json({ runs: await runReconciliation(ctx, req.staff!.id) });
    }),
  );
  return router;
}

/** docs/API_SPECIFICATION.md: GET /v1/reconciliation/settlements and /exceptions (staff only). */
export function reconciliationRoutes(ctx: AppContext): Router {
  const router = Router();
  const staff = requireStaff(ctx);
  router.get("/settlements", staff, (_req, res) => {
    res.json({ runs: listReconciliationRuns(ctx) });
  });
  router.get("/exceptions", staff, (req, res) => {
    res.json({ exceptions: listReconciliationExceptions(ctx, typeof req.query.runId === "string" ? req.query.runId : undefined) });
  });
  return router;
}
