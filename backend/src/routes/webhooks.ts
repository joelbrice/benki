import { Router } from "express";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { one, run } from "../db/query";
import { hmacHex, safeEqual } from "../lib/crypto";
import { badRequest, notFound, unauthorized } from "../lib/errors";
import { finalizeProviderTransaction } from "../services/settlement";

const MAX_SKEW_MS = 5 * 60 * 1000;

export function webhookSignature(secret: string, timestamp: string, rawBody: string): string {
  return hmacHex(secret, `${timestamp}.${rawBody}`);
}

/**
 * Provider callbacks (docs/SOLUTION_ARCHITECTURE.md: "asynchronous webhooks +
 * polling fallback"). Each request must carry an HMAC over timestamp + raw
 * body; stale timestamps and replayed event IDs are rejected.
 */
export function webhookRoutes(ctx: AppContext): Router {
  const router = Router();
  router.post("/providers/:providerId", (req, res) => {
    const adapter = ctx.providers.get(req.params.providerId);
    if (!adapter) throw notFound("Unknown provider");
    const timestamp = req.header("x-benki-timestamp") ?? "";
    const signature = req.header("x-benki-signature") ?? "";
    const raw = req.rawBody?.toString("utf8") ?? "";
    const skew = Math.abs(ctx.now().getTime() - Number(timestamp) * 1000);
    if (!timestamp || !Number.isFinite(skew) || skew > MAX_SKEW_MS) throw unauthorized("Stale or missing webhook timestamp");
    if (!safeEqual(webhookSignature(ctx.config.webhookSecret, timestamp, raw), signature)) throw unauthorized("Invalid webhook signature");

    let event;
    try {
      event = adapter.handleWebhook(req.body);
    } catch (error) {
      throw badRequest(error instanceof Error ? error.message : "Malformed webhook");
    }
    if (one(ctx.db, "SELECT event_id FROM webhook_events WHERE event_id = ?", event.eventId)) {
      res.json({ status: "duplicate_ignored" });
      return;
    }
    const tx = one<{ id: string }>(
      ctx.db,
      "SELECT id FROM transactions WHERE provider_ref = ? AND provider_id = ?",
      event.providerRef,
      adapter.id,
    );
    if (!tx) throw notFound("Unknown provider reference");
    withTx(ctx.db, () => {
      run(ctx.db, "INSERT INTO webhook_events (event_id, provider_id, received_at) VALUES (?, ?, ?)", event.eventId, adapter.id, ctx.nowIso());
      finalizeProviderTransaction(ctx, tx.id, event.status, `webhook ${event.eventId}`);
    });
    res.json({ status: "accepted" });
  });
  return router;
}
