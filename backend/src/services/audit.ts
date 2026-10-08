import type { AuditEntry, AuditVerification } from "@benki/shared";
import type { AppContext } from "../context";
import { all, one, run } from "../db/query";
import { canonicalJson, sha256Hex } from "../lib/crypto";

export type ActorType = "USER" | "STAFF" | "SYSTEM";

export interface AuditInput {
  actorType: ActorType;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details?: Record<string, unknown>;
}

interface AuditRow {
  seq: number;
  at: string;
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string;
  prev_hash: string;
  hash: string;
}

const GENESIS = "GENESIS";

function digest(row: Omit<AuditRow, "seq" | "hash">): string {
  return sha256Hex(
    canonicalJson({
      at: row.at,
      actorType: row.actor_type,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details,
      prevHash: row.prev_hash,
    }),
  );
}

/**
 * Appends to the hash-chained audit log. Each entry commits to the previous
 * entry's hash, so editing or deleting any row (even bypassing the DB
 * triggers, e.g. with a raw file edit) breaks verification from that point on.
 * Call inside the same transaction as the change being audited.
 */
export function audit(ctx: AppContext, input: AuditInput) {
  const prev = one<{ hash: string }>(ctx.db, "SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1");
  const row = {
    at: ctx.nowIso(),
    actor_type: input.actorType,
    actor_id: input.actorId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    details: canonicalJson(input.details ?? {}),
    prev_hash: prev?.hash ?? GENESIS,
  };
  run(
    ctx.db,
    `INSERT INTO audit_log (at, actor_type, actor_id, action, entity_type, entity_id, details, prev_hash, hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.at,
    row.actor_type,
    row.actor_id,
    row.action,
    row.entity_type,
    row.entity_id,
    row.details,
    row.prev_hash,
    digest(row),
  );
}

export function verifyAuditChain(ctx: AppContext): AuditVerification {
  const rows = all<AuditRow>(ctx.db, "SELECT * FROM audit_log ORDER BY seq");
  let prevHash = GENESIS;
  for (const row of rows) {
    if (row.prev_hash !== prevHash || digest(row) !== row.hash) {
      return { valid: false, checked: rows.length, firstBrokenSeq: row.seq };
    }
    prevHash = row.hash;
  }
  return { valid: true, checked: rows.length, firstBrokenSeq: null };
}

export function listAudit(ctx: AppContext, limit: number, entityId?: string): AuditEntry[] {
  const rows = entityId
    ? all<AuditRow>(ctx.db, "SELECT * FROM audit_log WHERE entity_id = ? ORDER BY seq DESC LIMIT ?", entityId, limit)
    : all<AuditRow>(ctx.db, "SELECT * FROM audit_log ORDER BY seq DESC LIMIT ?", limit);
  return rows.map((r) => ({
    seq: r.seq,
    at: r.at,
    actorType: r.actor_type,
    actorId: r.actor_id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    details: JSON.parse(r.details),
    hash: r.hash,
  }));
}
