import { describe, expect, it } from "vitest";
import { all, one } from "../src/db/query";
import { createCustomerAccount, systemAccount } from "../src/services/accounts";
import { audit } from "../src/services/audit";
import { balanceOf, LedgerInvariantError, postEntry, trialBalance } from "../src/services/ledger";
import { harness } from "./harness";

describe("double-entry ledger", () => {
  it("rejects entries that don't net to zero per currency", () => {
    const { ctx } = harness();
    const a = systemAccount(ctx, "SUSPENSE", "XOF");
    const b = systemAccount(ctx, "FEE_REVENUE", "XOF");
    expect(() =>
      postEntry(ctx, { transactionId: null, kind: "ADJUSTMENT", description: "bad", postings: [{ accountId: a, amountMinor: -100 }, { accountId: b, amountMinor: 90 }] }),
    ).toThrow(LedgerInvariantError);
  });

  it("nets per currency, so a cross-currency entry must balance in each currency", () => {
    const { ctx } = harness();
    const xof = systemAccount(ctx, "FX_POSITION", "XOF");
    const kes = systemAccount(ctx, "FX_POSITION", "KES");
    expect(() =>
      postEntry(ctx, { transactionId: null, kind: "ADJUSTMENT", description: "bad fx", postings: [{ accountId: xof, amountMinor: -100 }, { accountId: kes, amountMinor: 100 }] }),
    ).toThrow(/Unbalanced/);
  });

  it("never lets a customer account go negative, and rolls the whole entry back", () => {
    const { ctx } = harness();
    const wallet = createCustomerAccount(ctx, "WALLET", "XOF", "nobody", "test wallet");
    const suspense = systemAccount(ctx, "SUSPENSE", "XOF");
    const entriesBefore = one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM journal_entries")!.n;
    expect(() =>
      postEntry(ctx, { transactionId: null, kind: "ADJUSTMENT", description: "overdraw", postings: [{ accountId: wallet.id, amountMinor: -1 }, { accountId: suspense, amountMinor: 1 }] }),
    ).toThrow(/Insufficient funds/);
    expect(balanceOf(ctx, wallet.id)).toBe(0);
    expect(one<{ n: number }>(ctx.db, "SELECT COUNT(*) AS n FROM journal_entries")!.n).toBe(entriesBefore);
  });

  it("makes postings, journal entries and the audit log append-only at the database level", async () => {
    const { ctx } = harness();
    audit(ctx, { actorType: "SYSTEM", actorId: null, action: "TEST", entityType: "test", entityId: null });
    expect(() => ctx.db.exec("UPDATE postings SET amount_minor = amount_minor + 1")).toThrow(/immutable/);
    expect(() => ctx.db.exec("DELETE FROM postings")).toThrow(/immutable/);
    expect(() => ctx.db.exec("DELETE FROM journal_entries")).toThrow(/immutable/);
    expect(() => ctx.db.exec("UPDATE audit_log SET action = 'x'")).toThrow(/append-only/);
  });

  it("refuses postings whose currency differs from the account's", () => {
    const { ctx } = harness();
    const account = systemAccount(ctx, "SUSPENSE", "XOF");
    ctx.db.exec("INSERT INTO journal_entries (id, kind, description, created_at) VALUES ('JE_x', 'ADJUSTMENT', 'x', '2026-01-01')");
    expect(() =>
      ctx.db.prepare("INSERT INTO postings (entry_id, account_id, currency, amount_minor, created_at) VALUES ('JE_x', ?, 'KES', 5, '2026-01-01')").run(account),
    ).toThrow(/currency must match/);
  });

  it("stays balanced across a realistic mix of payments", async () => {
    const h = harness();
    const alice = await h.customer("+221700000001");
    const bob = await h.customer("+221700000002");
    await alice.fund(300_000);
    expect((await h.p2p(alice, bob, 10_000)).status).toBe(201);
    await alice.call("post", "/v1/payments/merchant", { idempotencyKey: h.key(), pin: "7391", merchantCode: "SN900100", amountMinor: 5_000 });
    await alice.call("post", "/v1/transfers/mobile-money", {
      idempotencyKey: h.key(),
      pin: "7391",
      providerId: "WAVE",
      destinationPhoneNumber: "+221771230000",
      amountMinor: 2_000,
    });
    const { runSettlementOnce } = await import("../src/services/settlement");
    await runSettlementOnce(h.ctx);

    const tb = trialBalance(h.ctx);
    expect(tb.balanced).toBe(true);
    expect(tb.unbalancedEntries).toEqual([]);
    expect(tb.negativeCustomerAccounts).toEqual([]);
    for (const c of tb.currencies) expect(c.netMinor).toBe(0);

    // Wallet balance is exactly the sum of its postings — no cached balance to drift.
    const postings = all<{ amount_minor: number }>(h.ctx.db, "SELECT amount_minor FROM postings WHERE account_id = ?", alice.walletId);
    expect((await alice.balance()).ledgerBalanceMinor).toBe(postings.reduce((s, p) => s + p.amount_minor, 0));
  });
});
