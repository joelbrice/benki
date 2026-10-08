import request from "supertest";
import { describe, expect, it } from "vitest";
import { run } from "../src/db/query";
import { DAY } from "../src/lib/clock";
import { balanceOf, trialBalance } from "../src/services/ledger";
import { runSettlementOnce } from "../src/services/settlement";
import { harness, PIN } from "./harness";

describe("bank transfers", () => {
  it("confirms the account holder's name before sending, then settles over the bank rail", async () => {
    const h = harness();
    const alice = await h.customer("+221700000501");
    await alice.fund(200_000);

    const missing = await alice.call("post", "/v1/transfers/bank/name-enquiry", { bankId: "SN-CBAO", accountNumber: "SN0012345404" });
    expect(missing.status).toBe(404);
    const enquiry = await alice.call("post", "/v1/transfers/bank/name-enquiry", { bankId: "SN-CBAO", accountNumber: "sn 0012 3456 78".toUpperCase() });
    expect(enquiry.status).toBe(200);
    expect(enquiry.body.accountNumber).toBe("SN0012345678");
    const accountName: string = enquiry.body.accountName;

    const send = (extra: object) =>
      alice.call("post", "/v1/transfers/bank", {
        idempotencyKey: h.key(),
        pin: PIN,
        bankId: "SN-CBAO",
        accountNumber: "SN0012345678",
        accountName,
        amountMinor: 100_000,
        ...extra,
      });
    const wrongName = await send({ accountName: "Someone Else" });
    expect(wrongName.status).toBe(409);
    expect((await alice.balance()).ledgerBalanceMinor).toBe(200_000);

    const sent = await send({});
    expect(sent.status).toBe(201);
    expect(sent.body.transaction.type).toBe("BANK_TRANSFER");
    expect(sent.body.transaction.feeMinor).toBe(500);
    expect(sent.body.transaction.counterparty).toContain(accountName);
    await runSettlementOnce(h.ctx);
    const [latest] = await alice.history();
    expect(latest.status).toBe("COMPLETED");
    expect((await alice.balance()).ledgerBalanceMinor).toBe(99_500);
    expect(trialBalance(h.ctx).balanced).toBe(true);
  });

  it("refunds automatically when the bank rejects the credit, and requires Tier 1", async () => {
    const h = harness();
    const alice = await h.customer("+221700000511");
    const tier0 = await h.customer("+221700000512", { tier: 0 });
    await alice.fund(50_000);
    const enquiry = await alice.call("post", "/v1/transfers/bank/name-enquiry", { bankId: "SN-ECOBANK", accountNumber: "SN99887766554444" });
    const failed = await alice.call("post", "/v1/transfers/bank", {
      idempotencyKey: h.key(),
      pin: PIN,
      bankId: "SN-ECOBANK",
      accountNumber: "SN99887766554444",
      accountName: enquiry.body.accountName,
      amountMinor: 10_000,
    });
    expect(failed.status).toBe(502);
    expect((await alice.balance()).ledgerBalanceMinor).toBe(50_000);

    const blocked = await tier0.call("post", "/v1/transfers/bank", {
      idempotencyKey: h.key(),
      pin: PIN,
      bankId: "SN-CBAO",
      accountNumber: "SN0012345678",
      accountName: enquiry.body.accountName,
      amountMinor: 1_000,
    });
    expect([403, 409]).toContain(blocked.status);
    expect((await tier0.balance()).ledgerBalanceMinor).toBe(0);
  });
});

describe("nano-loans", () => {
  it("sizes the offer from income, discloses the cost, and books fee-first repayments", async () => {
    const h = harness();
    const alice = await h.customer("+221700000601");

    const none = await alice.call("get", "/v1/loans/offer");
    expect(none.body.eligible).toBe(false);
    expect(none.body.reasons[0]).toMatch(/at least 3 times/);

    for (let i = 0; i < 3; i++) await alice.fund(300_000);
    const offer = await alice.call("get", "/v1/loans/offer");
    expect(offer.body).toMatchObject({ eligible: true, maxPrincipalMinor: 250_000, feeBps: 500, termDays: 30 });

    const apply = (extra: object) => alice.call("post", "/v1/loans", { idempotencyKey: h.key(), pin: PIN, principalMinor: 100_000, ...extra });
    expect((await apply({ acceptTerms: false })).status).toBe(400);
    expect((await apply({ acceptTerms: true, principalMinor: 250_001 })).status).toBe(400);
    const taken = await apply({ acceptTerms: true });
    expect(taken.status).toBe(201);
    expect(taken.body.loan).toMatchObject({ principalMinor: 100_000, feeMinor: 5_000, totalDueMinor: 105_000, status: "ACTIVE" });
    expect((await alice.balance()).ledgerBalanceMinor).toBe(1_000_000);
    expect((await apply({ acceptTerms: true })).status).toBe(409);

    const loanId: string = taken.body.loan.loanId;
    const repay = (amountMinor: number) => alice.call("post", `/v1/loans/${loanId}/repay`, { idempotencyKey: h.key(), pin: PIN, amountMinor });
    expect((await repay(105_001)).status).toBe(400);
    expect((await repay(3_000)).body.loan).toMatchObject({ repaidMinor: 3_000, outstandingMinor: 102_000 });
    const done = await repay(102_000);
    expect(done.body.loan.status).toBe("REPAID");
    expect(balanceOf(h.ctx, "SYS:LOAN_BOOK:XOF")).toBe(0);
    expect(balanceOf(h.ctx, "SYS:FEE_REVENUE:XOF")).toBe(5_000);
    expect(trialBalance(h.ctx).balanced).toBe(true);
  });

  it("never lends to an account under investigation and shows overdue loans in the loan book", async () => {
    const h = harness();
    const alice = await h.customer("+221700000611");
    const bob = await h.customer("+221700000612");
    for (let i = 0; i < 3; i++) {
      await alice.fund(100_000);
      await bob.fund(100_000);
    }
    await alice.signIn();
    await bob.signIn();
    const now = h.ctx.nowIso();
    run(h.ctx.db, "INSERT INTO cases (id, user_id, status, created_at, updated_at) VALUES ('CAS_T', ?, 'OPEN', ?, ?)", bob.userId, now, now);
    const offer = await bob.call("get", "/v1/loans/offer");
    expect(offer.body.eligible).toBe(false);
    expect(offer.body.reasons).toEqual(["Loans aren't available for this account right now."]);
    expect((await bob.call("post", "/v1/loans", { idempotencyKey: h.key(), pin: PIN, principalMinor: 10_000, acceptTerms: true })).status).toBe(403);

    await alice.call("post", "/v1/loans", { idempotencyKey: h.key(), pin: PIN, principalMinor: 50_000, acceptTerms: true });
    h.clock.advance(31 * DAY);
    await alice.signIn();
    expect((await alice.call("get", "/v1/loans")).body.loans[0].status).toBe("OVERDUE");
    const admin = await h.staff("supervisor");
    const dash = await admin("get", "/v1/admin/dashboard");
    expect(dash.body.loanBook).toEqual([{ currency: "XOF", activeLoans: 0, overdueLoans: 1, outstandingMinor: 52_500 }]);
  });
});

describe("savings groups", () => {
  it("pools contributions and releases money only after a member quorum (never the recipient's own vote)", async () => {
    const h = harness();
    const [alice, bob, carol, dave] = await Promise.all(
      ["+221700000701", "+221700000702", "+221700000703", "+221700000704"].map((p) => h.customer(p)),
    );
    const tier0 = await h.customer("+221700000705", { tier: 0 });
    const outsider = await h.customer("+221700000706");
    await alice.fund(100_000);
    await bob.fund(100_000);

    const created = await alice.call("post", "/v1/groups", { name: "Tontine Liberté 6" });
    expect(created.status).toBe(201);
    const groupId: string = created.body.group.groupId;
    for (const m of [bob, carol, dave]) {
      expect((await alice.call("post", `/v1/groups/${groupId}/members`, { phoneNumber: m.phone })).status).toBe(201);
    }
    expect((await alice.call("post", `/v1/groups/${groupId}/members`, { phoneNumber: tier0.phone })).status).toBe(400);
    expect((await bob.call("post", `/v1/groups/${groupId}/members`, { phoneNumber: outsider.phone })).status).toBe(403);
    expect((await outsider.call("get", `/v1/groups/${groupId}`)).status).toBe(404);

    for (const m of [alice, bob]) {
      const c = await m.call("post", `/v1/groups/${groupId}/contribute`, { idempotencyKey: h.key(), pin: PIN, amountMinor: 50_000 });
      expect(c.status).toBe(201);
    }
    let group = (await carol.call("get", `/v1/groups/${groupId}`)).body.group;
    expect(group.poolBalanceMinor).toBe(100_000);
    expect(group.approvalsRequired).toBe(2);

    const requested = await alice.call("post", `/v1/groups/${groupId}/payouts`, { pin: PIN, recipientUserId: bob.userId, amountMinor: 80_000, reason: "Bob's turn this month" });
    expect(requested.status).toBe(201);
    const requestId: string = requested.body.group.payoutRequests[0].requestId;
    expect(requested.body.group.payoutRequests[0].approvals).toBe(1);
    expect((await bob.call("post", `/v1/groups/${groupId}/payouts/${requestId}/vote`, { pin: PIN, approve: true })).status).toBe(403);
    expect((await bob.balance()).ledgerBalanceMinor).toBe(50_000);

    const approved = await carol.call("post", `/v1/groups/${groupId}/payouts/${requestId}/vote`, { pin: PIN, approve: true });
    expect(approved.status).toBe(200);
    expect(approved.body.group.payoutRequests[0].status).toBe("EXECUTED");
    expect(approved.body.group.poolBalanceMinor).toBe(20_000);
    expect((await bob.balance()).ledgerBalanceMinor).toBe(130_000);
    expect((await carol.call("post", `/v1/groups/${groupId}/payouts/${requestId}/vote`, { pin: PIN, approve: true })).status).toBe(409);

    expect((await bob.call("post", `/v1/groups/${groupId}/payouts`, { pin: PIN, recipientUserId: carol.userId, amountMinor: 50_000, reason: "Too much" })).status).toBe(400);
    const second = await bob.call("post", `/v1/groups/${groupId}/payouts`, { pin: PIN, recipientUserId: carol.userId, amountMinor: 10_000, reason: "Carol's turn" });
    const secondId: string = second.body.group.payoutRequests[0].requestId;
    await alice.call("post", `/v1/groups/${groupId}/payouts/${secondId}/vote`, { pin: PIN, approve: false });
    group = (await dave.call("post", `/v1/groups/${groupId}/payouts/${secondId}/vote`, { pin: PIN, approve: false })).body.group;
    expect(group.payoutRequests[0].status).toBe("REJECTED");
    expect(group.poolBalanceMinor).toBe(20_000);
    expect(trialBalance(h.ctx).balanced).toBe(true);
  });
});

describe("USSD channel", () => {
  const dial = (h: ReturnType<typeof harness>, sessionId: string, phoneNumber: string, text: string) =>
    request(h.app).post("/v1/ussd/simulator").type("form").send({ sessionId, phoneNumber, text });

  it("registers a feature-phone user and moves money through the same controls as the apps", async () => {
    const h = harness();
    const phone = "+221700000801";
    expect((await dial(h, "s-reg-1", phone, "")).text).toMatch(/^CON Welcome to Benki/);
    expect((await dial(h, "s-reg-1", phone, PIN)).text).toMatch(/^CON Re-enter/);
    expect((await dial(h, "s-reg-1", phone, `${PIN}*${PIN}`)).text).toMatch(/^END Your Benki account is ready/);

    const alice = await h.customer("+221700000802");
    await alice.fund(20_000);
    expect((await dial(h, "sess-1", alice.phone, "")).text).toMatch(/^CON Benki\n1\. Check balance/);
    expect((await dial(h, "sess-1", alice.phone, "1*0000")).text).toMatch(/^END Incorrect PIN|^END .*PIN/);
    expect((await dial(h, "sess-2", alice.phone, `1*${PIN}`)).text).toMatch(/^END Available: .*20,000/);

    expect((await dial(h, "sess-3", alice.phone, "2*0700000801")).text).toMatch(/^CON Send to/);
    expect((await dial(h, "sess-3", alice.phone, "2*0700000801*1500")).text).toMatch(/Enter PIN to confirm/);
    const sent = await dial(h, "sess-3", alice.phone, `2*0700000801*1500*${PIN}`);
    expect(sent.text).toMatch(/^END Transfer of .*1,500.* completed/);
    // A gateway retry of the same session replays instead of paying twice.
    expect((await dial(h, "sess-3", alice.phone, `2*0700000801*1500*${PIN}`)).text).toBe(sent.text);
    expect((await alice.balance()).ledgerBalanceMinor).toBe(18_500);

    const tooMuch = await dial(h, "sess-4", alice.phone, `2*0700000801*25000*${PIN}`);
    expect(tooMuch.text).toMatch(/^END (Insufficient|The most)/);
    expect((await dial(h, "sess-5", alice.phone, `5*${PIN}`)).text).toMatch(/^END Last transactions:\n.*-.*1,500/);
  });

  it("requires the gateway key on the production endpoint", async () => {
    const h = harness();
    const body = { sessionId: "s-gw-1", phoneNumber: "+221700000811", text: "" };
    expect((await request(h.app).post("/v1/ussd").send(body)).status).toBe(401);
    const ok = await request(h.app).post("/v1/ussd").set("x-ussd-gateway-key", h.ctx.config.ussdGatewayKey).send(body);
    expect(ok.status).toBe(200);
    expect(ok.text).toMatch(/^CON/);
  });
});
