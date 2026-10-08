import { formatAmount } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, run } from "../db/query";
import type { TransactionRow } from "../db/rows";
import { audit } from "./audit";
import { entriesForTransaction, reverseEntry } from "./ledger";
import { notify } from "./notifications";
import { getTransaction } from "./payments";
import { ProviderUnavailableError, type ProviderStatus } from "./providers";

/**
 * Applies a terminal provider status to a dispatched payout
 * (docs/LEDGER_RECONCILIATION_SPEC.md section 3, steps 4–5). Idempotent:
 * repeated webhooks or polls for an already-final transaction are no-ops.
 */
export function finalizeProviderTransaction(ctx: AppContext, txId: string, status: ProviderStatus, reason = "") {
  if (status === "PENDING") return;
  withTx(ctx.db, () => {
    const tx = getTransaction(ctx, txId);
    if (!tx || tx.status !== "PENDING") return;
    const now = ctx.nowIso();
    if (status === "COMPLETED") {
      run(ctx.db, "UPDATE transactions SET status = 'COMPLETED', completed_at = ?, updated_at = ? WHERE id = ?", now, now, txId);
      notify(ctx, tx.initiator_user_id, "TRANSACTION", `Delivered: ${formatAmount(tx.amount_minor, tx.currency)} to ${tx.counterparty_label}. Ref ${tx.id}.`);
    } else {
      const entry = entriesForTransaction(ctx, txId).find((e) => e.kind === "PAYMENT");
      if (entry) reverseEntry(ctx, entry.id, txId, `Refund: provider reported ${status}`);
      run(ctx.db, "UPDATE transactions SET status = 'FAILED', updated_at = ? WHERE id = ?", now, txId);
      notify(
        ctx,
        tx.initiator_user_id,
        "TRANSACTION",
        `Your transfer to ${tx.counterparty_label} didn't go through. ${formatAmount(tx.amount_minor + tx.fee_minor, tx.currency)} has been refunded. Ref ${tx.id}.`,
      );
    }
    audit(ctx, { actorType: "SYSTEM", actorId: null, action: `PROVIDER_${status}`, entityType: "transaction", entityId: txId, details: { reason } });
  });
}

/** Sends a posted payout to its rail. Called after the ledger entry commits. */
export async function dispatchPayout(ctx: AppContext, txId: string): Promise<TransactionRow> {
  const tx = getTransaction(ctx, txId)!;
  if (tx.status !== "PENDING" || !tx.provider_id) return tx;
  const adapter = ctx.providers.get(tx.provider_id);
  if (!adapter) {
    finalizeProviderTransaction(ctx, txId, "FAILED", "No adapter configured");
    return getTransaction(ctx, txId)!;
  }
  try {
    const meta = JSON.parse(tx.metadata) as { destination: string };
    const result = await adapter.initiateTransfer({
      reference: tx.id,
      amountMinor: tx.amount_minor,
      currency: tx.currency,
      destination: meta.destination,
    });
    run(ctx.db, "UPDATE transactions SET provider_ref = ?, updated_at = ? WHERE id = ?", result.providerRef, ctx.nowIso(), txId);
    finalizeProviderTransaction(ctx, txId, result.status);
  } catch (error) {
    if (!(error instanceof ProviderUnavailableError)) throw error;
    ctx.log.warn("provider unavailable", { providerId: tx.provider_id, transactionId: txId });
    finalizeProviderTransaction(ctx, txId, "FAILED", "Provider unavailable at dispatch");
  }
  return getTransaction(ctx, txId)!;
}

/** Polls the rails for in-flight payouts; also re-dispatches any that never reached the provider. */
export async function runSettlementOnce(ctx: AppContext) {
  const pending = all<TransactionRow>(
    ctx.db,
    "SELECT * FROM transactions WHERE status = 'PENDING' AND type = 'MOBILE_MONEY_PAYOUT' ORDER BY created_at",
  );
  let completed = 0;
  let failed = 0;
  for (const tx of pending) {
    if (!tx.provider_ref) {
      if (ctx.now().getTime() - new Date(tx.updated_at).getTime() > 30_000) await dispatchPayout(ctx, tx.id);
      continue;
    }
    const adapter = ctx.providers.get(tx.provider_id!);
    if (!adapter) continue;
    const status = await adapter.fetchStatus(tx.provider_ref);
    if (status === "PENDING") continue;
    finalizeProviderTransaction(ctx, tx.id, status, "status poll");
    if (status === "COMPLETED") completed++;
    else failed++;
  }
  return { checked: pending.length, completed, failed };
}

export function startSettlementWorker(ctx: AppContext): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    runSettlementOnce(ctx)
      .catch((error) => ctx.log.error("settlement worker failed", { error: String(error) }))
      .finally(() => {
        running = false;
      });
  }, ctx.config.settlementIntervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
