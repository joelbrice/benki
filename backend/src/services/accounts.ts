import type { AppContext } from "../context";
import { one, run } from "../db/query";
import type { AccountRow } from "../db/rows";
import { newId } from "../lib/ids";

/** Customer-owned accounts: these must never go negative. */
export type CustomerAccountKind = "WALLET" | "VAULT" | "MERCHANT_WALLET" | "AGENT_FLOAT" | "GROUP_POOL";

/**
 * Platform accounts. Signed-amount convention: a positive posting increases
 * the account's balance as the platform reports it. System accounts are
 * clearing/contra accounts and may run negative (e.g. ISSUANCE goes negative
 * as e-money is issued against the trust account).
 */
export type SystemAccountKind =
  | "ISSUANCE"
  | "FEE_REVENUE"
  | "MOMO_SETTLEMENT"
  | "BILLER_SETTLEMENT"
  | "AIRTIME_CLEARING"
  | "FX_POSITION"
  | "BANK_SETTLEMENT"
  | "LOAN_BOOK"
  | "SUSPENSE";

export function getAccount(ctx: AppContext, id: string): AccountRow | undefined {
  return one<AccountRow>(ctx.db, "SELECT * FROM accounts WHERE id = ?", id);
}

export function createCustomerAccount(
  ctx: AppContext,
  kind: CustomerAccountKind,
  currency: string,
  ownerId: string,
  label: string,
  id = newId({ WALLET: "WAL", VAULT: "VLT", AGENT_FLOAT: "AGF", MERCHANT_WALLET: "MWL", GROUP_POOL: "GRP" }[kind]),
): AccountRow {
  run(
    ctx.db,
    "INSERT INTO accounts (id, kind, currency, owner_id, label, allow_negative, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)",
    id,
    kind,
    currency,
    ownerId,
    label,
    ctx.nowIso(),
  );
  return getAccount(ctx, id)!;
}

export function systemAccount(ctx: AppContext, kind: SystemAccountKind, currency: string, discriminator?: string): string {
  const id = ["SYS", kind, discriminator, currency].filter(Boolean).join(":");
  run(
    ctx.db,
    `INSERT INTO accounts (id, kind, currency, owner_id, label, allow_negative, created_at)
     VALUES (?, ?, ?, NULL, ?, 1, ?) ON CONFLICT (id) DO NOTHING`,
    id,
    kind,
    currency,
    [kind, discriminator].filter(Boolean).join(" "),
    ctx.nowIso(),
  );
  return id;
}

export function agentFloatAccountId(agentId: string): string {
  return `AGF:${agentId}`;
}
