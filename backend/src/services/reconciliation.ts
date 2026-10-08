import type { ReconciliationBreak, ReconciliationException, ReconciliationRun, TransactionStatus } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, run } from "../db/query";
import type { TransactionRow } from "../db/rows";
import { newId } from "../lib/ids";
import { audit } from "./audit";
import { EXTERNAL_RAIL_TYPES, type ProviderRecord } from "./providers";

const RAIL_TYPES = EXTERNAL_RAIL_TYPES.map((t) => `'${t}'`).join(",");

interface ExceptionDraft {
  category: ReconciliationBreak;
  transactionId: string | null;
  providerRef: string | null;
  internalAmountMinor: number | null;
  providerAmountMinor: number | null;
  internalStatus: TransactionStatus | null;
  providerStatus: string | null;
}

/** Internal states that should agree with a provider's terminal state. */
function comparableStatus(status: TransactionStatus): string | null {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "FAILED") return "FAILED";
  return null;
}

/**
 * Matches our dispatched payouts against the provider's settlement report and
 * categorizes every break (docs/LEDGER_RECONCILIATION_SPEC.md section 5).
 */
export async function runReconciliation(ctx: AppContext, actorId: string | null): Promise<ReconciliationRun[]> {
  const runs: ReconciliationRun[] = [];
  for (const [providerId, adapter] of ctx.providers) {
    const currencies = all<{ currency: string }>(
      ctx.db,
      `SELECT currency FROM transactions WHERE provider_id = ? AND type IN (${RAIL_TYPES}) AND provider_ref IS NOT NULL
       UNION SELECT currency FROM provider_records WHERE provider_id = ?`,
      providerId,
      providerId,
    ).map((r) => r.currency);

    for (const currency of currencies) {
      const records = await adapter.reconcileBatch(currency);
      const internal = all<TransactionRow>(
        ctx.db,
        `SELECT * FROM transactions WHERE provider_id = ? AND currency = ? AND type IN (${RAIL_TYPES}) AND provider_ref IS NOT NULL`,
        providerId,
        currency,
      );
      const byRef = new Map<string, ProviderRecord[]>();
      for (const r of records) byRef.set(r.providerRef, [...(byRef.get(r.providerRef) ?? []), r]);

      const exceptions: ExceptionDraft[] = [];
      let matched = 0;
      for (const tx of internal) {
        const recs = byRef.get(tx.provider_ref!);
        byRef.delete(tx.provider_ref!);
        const ex = (category: ReconciliationBreak, rec?: ProviderRecord) =>
          exceptions.push({
            category,
            transactionId: tx.id,
            providerRef: tx.provider_ref,
            internalAmountMinor: tx.amount_minor,
            providerAmountMinor: rec?.amountMinor ?? null,
            internalStatus: tx.status,
            providerStatus: rec?.status ?? null,
          });
        if (!recs?.length) {
          ex("MISSING_PROVIDER_REFERENCE");
          continue;
        }
        const before = exceptions.length;
        const rec = recs[0];
        if (recs.length > 1) ex("DUPLICATE_SETTLEMENT_ENTRY", rec);
        if (rec.amountMinor !== tx.amount_minor) ex("AMOUNT_MISMATCH", rec);
        const ours = comparableStatus(tx.status);
        if (ours && rec.status !== "PENDING" && ours !== rec.status) ex("STATUS_MISMATCH", rec);
        if (exceptions.length === before) matched++;
      }
      for (const [ref, recs] of byRef) {
        exceptions.push({
          category: "UNMATCHED_PROVIDER_RECORD",
          transactionId: null,
          providerRef: ref,
          internalAmountMinor: null,
          providerAmountMinor: recs[0].amountMinor,
          internalStatus: null,
          providerStatus: recs[0].status,
        });
      }

      const internalSettlement = internal.filter((t) => t.status === "COMPLETED").reduce((s, t) => s + t.amount_minor, 0);
      const providerSettlement = records.filter((r) => r.status === "COMPLETED").reduce((s, r) => s + r.amountMinor, 0);
      const runId = newId("REC");
      const ranAt = ctx.nowIso();
      withTx(ctx.db, () => {
        run(
          ctx.db,
          `INSERT INTO recon_runs (id, provider_id, currency, ran_at, matched, exceptions, internal_settlement_minor, provider_settlement_minor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          runId,
          providerId,
          currency,
          ranAt,
          matched,
          exceptions.length,
          internalSettlement,
          providerSettlement,
        );
        for (const e of exceptions) {
          run(
            ctx.db,
            `INSERT INTO recon_exceptions (id, run_id, provider_id, category, transaction_id, provider_ref, internal_amount_minor,
               provider_amount_minor, internal_status, provider_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            newId("RXC"),
            runId,
            providerId,
            e.category,
            e.transactionId,
            e.providerRef,
            e.internalAmountMinor,
            e.providerAmountMinor,
            e.internalStatus,
            e.providerStatus,
            ranAt,
          );
        }
        audit(ctx, {
          actorType: actorId ? "STAFF" : "SYSTEM",
          actorId,
          action: "RECONCILIATION_RUN",
          entityType: "recon_run",
          entityId: runId,
          details: { providerId, currency, matched, exceptions: exceptions.length },
        });
      });
      runs.push({
        runId,
        providerId,
        ranAt,
        matched,
        exceptions: exceptions.length,
        internalSettlementMinor: internalSettlement,
        providerSettlementMinor: providerSettlement,
        currency,
      });
    }
  }
  return runs;
}

export function listReconciliationRuns(ctx: AppContext): ReconciliationRun[] {
  return all<{
    id: string;
    provider_id: string;
    currency: string;
    ran_at: string;
    matched: number;
    exceptions: number;
    internal_settlement_minor: number;
    provider_settlement_minor: number;
  }>(ctx.db, "SELECT * FROM recon_runs ORDER BY ran_at DESC, rowid DESC LIMIT 100").map((r) => ({
    runId: r.id,
    providerId: r.provider_id,
    currency: r.currency,
    ranAt: r.ran_at,
    matched: r.matched,
    exceptions: r.exceptions,
    internalSettlementMinor: r.internal_settlement_minor,
    providerSettlementMinor: r.provider_settlement_minor,
  }));
}

export function listReconciliationExceptions(ctx: AppContext, runId?: string): ReconciliationException[] {
  const rows = all<{
    id: string;
    run_id: string;
    provider_id: string;
    category: ReconciliationBreak;
    transaction_id: string | null;
    provider_ref: string | null;
    internal_amount_minor: number | null;
    provider_amount_minor: number | null;
    internal_status: TransactionStatus | null;
    provider_status: string | null;
    created_at: string;
  }>(
    ctx.db,
    runId
      ? "SELECT * FROM recon_exceptions WHERE run_id = ? ORDER BY created_at DESC"
      : "SELECT * FROM recon_exceptions WHERE run_id IN (SELECT id FROM recon_runs ORDER BY ran_at DESC, rowid DESC LIMIT 20) ORDER BY created_at DESC",
    ...(runId ? [runId] : []),
  );
  return rows.map((r) => ({
    exceptionId: r.id,
    runId: r.run_id,
    providerId: r.provider_id,
    category: r.category,
    transactionId: r.transaction_id,
    providerRef: r.provider_ref,
    internalAmountMinor: r.internal_amount_minor,
    providerAmountMinor: r.provider_amount_minor,
    internalStatus: r.internal_status,
    providerStatus: r.provider_status,
    createdAt: r.created_at,
  }));
}
