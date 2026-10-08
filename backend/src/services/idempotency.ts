import type { AppContext } from "../context";
import { one, run } from "../db/query";
import { canonicalJson, sha256Hex } from "../lib/crypto";
import { conflict } from "../lib/errors";

export interface IdempotencyHandle {
  scope: string;
  key: string;
  requestHash: string;
}

/** Hash of the request body, excluding secrets (the PIN never reaches storage). */
export function requestHashOf(body: Record<string, unknown>): string {
  const { pin: _pin, currentPin: _c, newPin: _n, ...rest } = body;
  return sha256Hex(canonicalJson(rest));
}

/**
 * Claims an idempotency key inside the caller's transaction. Returns the
 * stored response for an exact replay; rejects reuse of a key with a
 * different payload (docs/LEDGER_RECONCILIATION_SPEC.md section 4).
 */
export function claimIdempotencyKey(
  ctx: AppContext,
  handle: IdempotencyHandle,
): { replay: true; status: number; body: unknown } | { replay: false } {
  const row = one<{ request_hash: string; status_code: number | null; response: string | null }>(
    ctx.db,
    "SELECT request_hash, status_code, response FROM idempotency_keys WHERE scope = ? AND key = ?",
    handle.scope,
    handle.key,
  );
  if (row) {
    if (row.request_hash !== handle.requestHash) {
      throw conflict("This idempotency key was already used for a different request");
    }
    if (row.status_code === null) throw conflict("This request is still being processed");
    return { replay: true, status: row.status_code, body: JSON.parse(row.response ?? "null") };
  }
  run(
    ctx.db,
    "INSERT INTO idempotency_keys (scope, key, request_hash, created_at) VALUES (?, ?, ?, ?)",
    handle.scope,
    handle.key,
    handle.requestHash,
    ctx.nowIso(),
  );
  return { replay: false };
}

export function completeIdempotencyKey(ctx: AppContext, handle: IdempotencyHandle, status: number, body: unknown) {
  run(
    ctx.db,
    "UPDATE idempotency_keys SET status_code = ?, response = ? WHERE scope = ? AND key = ?",
    status,
    JSON.stringify(body),
    handle.scope,
    handle.key,
  );
}
