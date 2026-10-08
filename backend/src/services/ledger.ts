import type { TrialBalance } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { AccountRow } from "../db/rows";
import { insufficientFunds } from "../lib/errors";
import { newId } from "../lib/ids";

export interface PostingInput {
  accountId: string;
  amountMinor: number;
}

export interface EntryInput {
  transactionId: string | null;
  kind: "PAYMENT" | "REVERSAL" | "OPENING" | "ADJUSTMENT" | "REFUND";
  description: string;
  postings: PostingInput[];
}

/** Raised when code tries to post something that violates ledger invariants. */
export class LedgerInvariantError extends Error {}

export function balanceOf(ctx: AppContext, accountId: string): number {
  const row = one<{ total: number | null }>(
    ctx.db,
    "SELECT SUM(amount_minor) AS total FROM postings WHERE account_id = ?",
    accountId,
  );
  return row?.total ?? 0;
}

export function activeHoldsOf(ctx: AppContext, accountId: string): number {
  const row = one<{ total: number | null }>(
    ctx.db,
    "SELECT SUM(amount_minor) AS total FROM holds WHERE account_id = ? AND status = 'ACTIVE'",
    accountId,
  );
  return row?.total ?? 0;
}

export function availableOf(ctx: AppContext, accountId: string): number {
  return balanceOf(ctx, accountId) - activeHoldsOf(ctx, accountId);
}

/**
 * Posts a balanced journal entry atomically. Guarantees, in order:
 *  1. every amount is a non-zero safe integer;
 *  2. postings net to zero per currency (double-entry);
 *  3. no non-negative account (customer wallet, vault, agent float) is driven
 *     below zero or into funds reserved by an active hold.
 * Any violation rolls the whole entry back.
 */
export function postEntry(ctx: AppContext, input: EntryInput): string {
  const postings = input.postings.filter((p) => p.amountMinor !== 0);
  if (postings.length < 2) throw new LedgerInvariantError("A journal entry needs at least two postings");

  return withTx(ctx.db, () => {
    const accounts = new Map<string, AccountRow>();
    const netByCurrency = new Map<string, number>();
    for (const p of postings) {
      if (!Number.isSafeInteger(p.amountMinor)) throw new LedgerInvariantError("Posting amounts must be safe integers");
      const account = accounts.get(p.accountId) ?? one<AccountRow>(ctx.db, "SELECT * FROM accounts WHERE id = ?", p.accountId);
      if (!account) throw new LedgerInvariantError(`Unknown account ${p.accountId}`);
      accounts.set(account.id, account);
      netByCurrency.set(account.currency, (netByCurrency.get(account.currency) ?? 0) + p.amountMinor);
    }
    for (const [currency, net] of netByCurrency) {
      if (net !== 0) throw new LedgerInvariantError(`Unbalanced journal entry: ${currency} nets to ${net}`);
    }

    const entryId = newId("JE");
    const now = ctx.nowIso();
    run(
      ctx.db,
      "INSERT INTO journal_entries (id, transaction_id, kind, description, created_at) VALUES (?, ?, ?, ?, ?)",
      entryId,
      input.transactionId,
      input.kind,
      input.description,
      now,
    );
    for (const p of postings) {
      const account = accounts.get(p.accountId)!;
      run(
        ctx.db,
        "INSERT INTO postings (entry_id, account_id, currency, amount_minor, created_at) VALUES (?, ?, ?, ?, ?)",
        entryId,
        account.id,
        account.currency,
        p.amountMinor,
        now,
      );
    }

    const debited = new Set(postings.filter((p) => p.amountMinor < 0).map((p) => p.accountId));
    for (const accountId of debited) {
      const account = accounts.get(accountId)!;
      if (account.allow_negative) continue;
      if (availableOf(ctx, accountId) < 0) {
        throw account.kind === "AGENT_FLOAT"
          ? insufficientFunds("The agent doesn't have enough float for this amount. Try a smaller amount or another agent.")
          : insufficientFunds();
      }
    }
    return entryId;
  });
}

/** Compensating entry: posts the exact negation of an earlier entry. */
export function reverseEntry(ctx: AppContext, entryId: string, transactionId: string, description: string): string {
  const postings = all<{ account_id: string; amount_minor: number }>(
    ctx.db,
    "SELECT account_id, amount_minor FROM postings WHERE entry_id = ?",
    entryId,
  );
  if (!postings.length) throw new LedgerInvariantError(`Nothing to reverse for ${entryId}`);
  return postEntry(ctx, {
    transactionId,
    kind: "REVERSAL",
    description,
    postings: postings.map((p) => ({ accountId: p.account_id, amountMinor: -p.amount_minor })),
  });
}

export function placeHold(ctx: AppContext, accountId: string, transactionId: string, amountMinor: number) {
  withTx(ctx.db, () => {
    if (availableOf(ctx, accountId) < amountMinor) throw insufficientFunds();
    run(
      ctx.db,
      "INSERT INTO holds (id, account_id, transaction_id, amount_minor, status, created_at) VALUES (?, ?, ?, ?, 'ACTIVE', ?)",
      newId("HLD"),
      accountId,
      transactionId,
      amountMinor,
      ctx.nowIso(),
    );
  });
}

export function resolveHolds(ctx: AppContext, transactionId: string, outcome: "RELEASED" | "CAPTURED") {
  run(
    ctx.db,
    "UPDATE holds SET status = ?, resolved_at = ? WHERE transaction_id = ? AND status = 'ACTIVE'",
    outcome,
    ctx.nowIso(),
    transactionId,
  );
}

export function entriesForTransaction(ctx: AppContext, transactionId: string) {
  return all<{ id: string; kind: string }>(
    ctx.db,
    "SELECT id, kind FROM journal_entries WHERE transaction_id = ? ORDER BY created_at, rowid",
    transactionId,
  );
}

const CUSTOMER_KINDS = ["WALLET", "VAULT", "MERCHANT_WALLET", "AGENT_FLOAT"];

export function trialBalance(ctx: AppContext): TrialBalance {
  const currencies = all<{ currency: string; debits: number; credits: number }>(
    ctx.db,
    `SELECT currency,
            -SUM(CASE WHEN amount_minor < 0 THEN amount_minor ELSE 0 END) AS debits,
            SUM(CASE WHEN amount_minor > 0 THEN amount_minor ELSE 0 END) AS credits
     FROM postings GROUP BY currency ORDER BY currency`,
  );
  const unbalanced = all<{ entry_id: string }>(
    ctx.db,
    "SELECT entry_id FROM postings GROUP BY entry_id, currency HAVING SUM(amount_minor) <> 0",
  );
  const negative = all<{ id: string }>(
    ctx.db,
    `SELECT a.id FROM accounts a JOIN postings p ON p.account_id = a.id
     WHERE a.kind IN (${CUSTOMER_KINDS.map(() => "?").join(",")})
     GROUP BY a.id HAVING SUM(p.amount_minor) < 0`,
    ...CUSTOMER_KINDS,
  );
  const byKind = all<{ kind: string; currency: string; balance: number }>(
    ctx.db,
    `SELECT a.kind, a.currency, COALESCE(SUM(p.amount_minor), 0) AS balance
     FROM accounts a LEFT JOIN postings p ON p.account_id = a.id
     GROUP BY a.kind, a.currency ORDER BY a.kind, a.currency`,
  );
  const rows = currencies.map((c) => ({
    currency: c.currency,
    totalDebitsMinor: c.debits ?? 0,
    totalCreditsMinor: c.credits ?? 0,
    netMinor: (c.credits ?? 0) - (c.debits ?? 0),
  }));
  return {
    balanced: rows.every((r) => r.netMinor === 0) && unbalanced.length === 0 && negative.length === 0,
    currencies: rows,
    unbalancedEntries: [...new Set(unbalanced.map((u) => u.entry_id))],
    negativeCustomerAccounts: negative.map((n) => n.id),
    accountsByKind: byKind.map((b) => ({ kind: b.kind, currency: b.currency, balanceMinor: b.balance })),
    checkedAt: ctx.nowIso(),
  };
}
