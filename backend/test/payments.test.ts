import { describe, expect, it } from "vitest";
import { MINUTE } from "../src/lib/clock";
import { trialBalance } from "../src/services/ledger";
import { runSettlementOnce } from "../src/services/settlement";
import { harness, PIN } from "./harness";

describe("payments", () => {
  it("moves money exactly once per idempotency key and rejects key reuse with a different body", async () => {
    const h = harness();
    const alice = await h.customer("+221700000011");
    const bob = await h.customer("+221700000012");
    await alice.fund(100_000);
    const body = { idempotencyKey: "same-key-0001", pin: PIN, destinationPhoneNumber: bob.phone, amountMinor: 10_000 };
    const first = await alice.call("post", "/v1/transfers/internal", body);
    const replay = await alice.call("post", "/v1/transfers/internal", body);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(replay.body.transaction.id).toBe(first.body.transaction.id);
    expect((await bob.balance()).ledgerBalanceMinor).toBe(10_000);

    const conflict = await alice.call("post", "/v1/transfers/internal", { ...body, amountMinor: 20_000 });
    expect(conflict.status).toBe(409);
    expect((await bob.balance()).ledgerBalanceMinor).toBe(10_000);
  });

  it("enforces per-transaction, daily and balance-cap limits", async () => {
    const h = harness();
    const alice = await h.customer("+221700000021"); // SN Tier 1: 500k per tx, 1M daily, 2M max balance
    const bob = await h.customer("+221700000022");
    const tier0 = await h.customer("+221700000023", { tier: 0 }); // SN Tier 0: 200k max balance
    await alice.fund(2_000_000);

    const capped = await alice.call("post", `/v1/wallets/${alice.walletId}/cash-in`, { idempotencyKey: h.key(), agentId: "SN-01", amountMinor: 1 });
    expect(capped.status).toBe(422);
    expect(capped.body.error.code).toBe("LIMIT_EXCEEDED");

    expect((await h.p2p(alice, bob, 500_001)).body.error.code).toBe("LIMIT_EXCEEDED");
    expect((await h.p2p(alice, bob, 500_000)).status).toBe(201);
    expect((await h.p2p(alice, bob, 500_000)).status).toBe(201);
    const daily = await h.p2p(alice, bob, 1);
    expect(daily.status).toBe(422);
    expect(daily.body.error.message).toMatch(/daily limit/);

    h.clock.advance(25 * 60 * MINUTE);
    await alice.signIn();
    expect((await h.p2p(alice, tier0, 150_000)).status).toBe(201);
    const recipientCap = await h.p2p(alice, tier0, 60_000);
    expect(recipientCap.status).toBe(422);
    expect(recipientCap.body.error.message).toBe("The recipient can't receive this amount right now.");
  });

  it("locks the PIN after three wrong attempts, even if the correct PIN follows", async () => {
    const h = harness();
    const alice = await h.customer("+221700000031");
    const bob = await h.customer("+221700000032");
    await alice.fund(50_000);
    for (const expected of ["PIN_INVALID", "PIN_INVALID", "PIN_LOCKED"]) {
      const res = await h.p2p(alice, bob, 1_000, { pin: "0864" });
      expect(res.body.error.code).toBe(expected);
    }
    expect((await h.p2p(alice, bob, 1_000)).body.error.code).toBe("PIN_LOCKED");
    h.clock.advance(31 * MINUTE);
    expect((await h.p2p(alice, bob, 1_000)).status).toBe(201);
  });

  it("charges and discloses fees, and says how much is needed when funds are short", async () => {
    const h = harness();
    const alice = await h.customer("+221700000041");
    await alice.fund(10_000);
    const pricing = await alice.call("get", "/v1/pricing/quote?type=MOBILE_MONEY_PAYOUT&amountMinor=10000");
    expect(pricing.body).toMatchObject({ feeMinor: 100, totalDebitMinor: 10_100, currency: "XOF" });
    const short = await alice.call("post", "/v1/transfers/mobile-money", {
      idempotencyKey: h.key(),
      pin: PIN,
      providerId: "WAVE",
      destinationPhoneNumber: "+221771231234",
      amountMinor: 10_000,
    });
    expect(short.status).toBe(422);
    expect(short.body.error.message).toContain("10,100 XOF including the 100 XOF fee");
  });

  it("settles mobile money payouts asynchronously and refunds failures in full", async () => {
    const h = harness();
    const alice = await h.customer("+221700000051");
    await alice.fund(100_000);
    const send = (destination: string) =>
      alice.call("post", "/v1/transfers/mobile-money", {
        idempotencyKey: h.key(),
        pin: PIN,
        providerId: "ORANGE_MONEY",
        destinationPhoneNumber: destination,
        amountMinor: 10_000,
      });
    const ok = await send("+221771231234");
    expect(ok.status).toBe(201);
    expect(ok.body.transaction.status).toBe("PENDING");
    expect(ok.body.wallet.pendingBalanceMinor).toBe(10_100);

    const failing = await send("+221771230000");
    expect(failing.body.transaction.status).toBe("PENDING");
    expect((await alice.balance()).ledgerBalanceMinor).toBe(100_000 - 2 * 10_100);

    await runSettlementOnce(h.ctx);
    const history = await alice.history();
    expect(history.find((t) => t.id === ok.body.transaction.id)?.status).toBe("COMPLETED");
    expect(history.find((t) => t.id === failing.body.transaction.id)?.status).toBe("FAILED");
    expect((await alice.balance()).ledgerBalanceMinor).toBe(100_000 - 10_100);

    const outage = await send("+221771234444");
    expect(outage.status).toBe(502);
    expect(outage.body.error.code).toBe("PROVIDER_UNAVAILABLE");
    expect((await alice.balance()).ledgerBalanceMinor).toBe(100_000 - 10_100);
    expect(trialBalance(h.ctx).balanced).toBe(true);
  });

  it("converts cross-border transfers at the locked quote and keeps each currency balanced", async () => {
    const h = harness();
    const alice = await h.customer("+221700000061");
    const kenyan = await h.customer("+254700000062", { country: "KE" });
    await alice.fund(400_000);

    const quote = await alice.call("post", "/v1/transfers/cross-border/quote", { destinationCountryCode: "KE", sendAmountMinor: 300_000 });
    expect(quote.status).toBe(201);
    // 300,000 XOF -> 500 USD -> 64,500 KES at mid, minus the 1% margin -> 63,855.00 KES
    expect(quote.body).toMatchObject({ sendCurrency: "XOF", receiveCurrency: "KES", receiveAmountMinor: 6_385_500, feeMinor: 4_500 });

    const send = (quoteId: string) =>
      alice.call("post", "/v1/transfers/cross-border", {
        idempotencyKey: h.key(),
        pin: PIN,
        quoteId,
        destinationPhoneNumber: kenyan.phone,
        purposeCode: "FAMILY_SUPPORT",
      });
    // 300,000 XOF is >= 50% of the 500,000 Tier 1 per-transaction limit, so it's held for EDD.
    const held = await send(quote.body.quoteId);
    expect(held.status).toBe(202);
    expect(held.body.transaction.status).toBe("PENDING_REVIEW");
    expect((await send(quote.body.quoteId)).status).toBe(409);

    const small = await alice.call("post", "/v1/transfers/cross-border/quote", { destinationCountryCode: "KE", sendAmountMinor: 6_000 });
    const sent = await send(small.body.quoteId);
    expect(sent.status).toBe(201);
    expect((await kenyan.balance()).ledgerBalanceMinor).toBe(small.body.receiveAmountMinor);

    const stale = await alice.call("post", "/v1/transfers/cross-border/quote", { destinationCountryCode: "KE", sendAmountMinor: 6_000 });
    h.clock.advance(61_000);
    expect((await send(stale.body.quoteId)).body.error.message).toMatch(/expired/);

    const tb = trialBalance(h.ctx);
    expect(tb.balanced).toBe(true);
    expect(tb.currencies.find((c) => c.currency === "KES")!.netMinor).toBe(0);
  });

  it("pays merchants net of the merchant discount rate and issues prepaid electricity tokens", async () => {
    const h = harness();
    const alice = await h.customer("+221700000071");
    await alice.fund(100_000);
    const merchant = await alice.call("post", "/v1/payments/merchant", { idempotencyKey: h.key(), pin: PIN, merchantCode: "SN900200", amountMinor: 10_000 });
    expect(merchant.status).toBe(201);
    expect(merchant.body.transaction.feeMinor).toBe(0);
    const tb = trialBalance(h.ctx);
    expect(tb.accountsByKind.find((a) => a.kind === "FEE_REVENUE" && a.currency === "XOF")!.balanceMinor).toBe(100);
    expect(tb.accountsByKind.find((a) => a.kind === "MERCHANT_WALLET" && a.currency === "XOF")!.balanceMinor).toBe(9_900);

    const bill = await alice.call("post", "/v1/payments/bills", { idempotencyKey: h.key(), pin: PIN, billerId: "SN-POWER", accountNumber: "04512345678", amountMinor: 5_000 });
    expect(bill.status).toBe(201);
    expect(bill.body.transaction.token).toMatch(/^\d{4}(-\d{4}){4}$/);
    const badMeter = await alice.call("post", "/v1/payments/bills", { idempotencyKey: h.key(), pin: PIN, billerId: "SN-POWER", accountNumber: "123", amountMinor: 5_000 });
    expect(badMeter.status).toBe(400);
  });

  it("moves money in and out of savings vaults without leaving customer funds", async () => {
    const h = harness();
    const alice = await h.customer("+221700000081");
    await alice.fund(50_000);
    const vault = (await alice.call("post", "/v1/savings", { name: "Harvest", targetMinor: 100_000 })).body.vault;
    expect((await alice.call("post", `/v1/savings/${vault.vaultId}/deposit`, { idempotencyKey: h.key(), amountMinor: 20_000 })).status).toBe(201);
    expect((await alice.call("post", `/v1/savings/${vault.vaultId}/withdraw`, { idempotencyKey: h.key(), amountMinor: 25_000 })).body.error.code).toBe("INSUFFICIENT_FUNDS");
    expect((await alice.call("post", `/v1/savings/${vault.vaultId}/withdraw`, { idempotencyKey: h.key(), amountMinor: 5_000 })).status).toBe(201);
    expect((await alice.balance()).ledgerBalanceMinor).toBe(35_000);
    expect((await alice.call("get", "/v1/savings")).body.vaults[0].balanceMinor).toBe(15_000);
    expect((await alice.call("get", "/v1/limits")).body.totalHoldingsMinor).toBe(50_000);
  });

  it("exports a statement with a running balance straight from the postings", async () => {
    const h = harness();
    const alice = await h.customer("+221700000091");
    const bob = await h.customer("+221700000092");
    await alice.fund(20_000);
    await h.p2p(alice, bob, 5_000);
    const csv = await alice.call("get", `/v1/wallets/${alice.walletId}/statement.csv`);
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    const lines = csv.text.trim().split("\n");
    expect(lines[0]).toBe("Date,Reference,Type,Details,Debit,Credit,Balance,Currency");
    expect(lines.at(-1)).toMatch(/,5000,,15000,XOF$/);
  });
});
