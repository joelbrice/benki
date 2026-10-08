import request from "supertest";
import { describe, expect, it } from "vitest";
import { all } from "../src/db/query";
import { trialBalance } from "../src/services/ledger";
import { runSettlementOnce } from "../src/services/settlement";
import { webhookSignature } from "../src/routes/webhooks";
import { harness, PIN, STAFF_PASSWORD } from "./harness";

describe("four-eyes controls", () => {
  it("reverses a payment only after a second supervisor approves", async () => {
    const h = harness();
    const alice = await h.customer("+221700000201");
    const bob = await h.customer("+221700000202");
    await alice.fund(50_000);
    const txId = (await h.p2p(alice, bob, 10_000)).body.transaction.id;

    const maker = await h.staff("supervisor");
    const approvalId = (await maker("post", "/v1/admin/approvals", { action: "REVERSAL", payload: { transactionId: txId }, reason: "Customer sent to wrong number" })).body.approval.approvalId;
    const self = await maker("post", `/v1/admin/approvals/${approvalId}/approve`, {});
    expect(self.status).toBe(403);
    expect(self.body.error.message).toMatch(/Four-eyes/);

    const checker = await h.staff("supervisor2");
    const decided = await checker("post", `/v1/admin/approvals/${approvalId}/approve`, {});
    expect(decided.body.approval.status).toBe("APPROVED");
    expect((await alice.balance()).ledgerBalanceMinor).toBe(50_000);
    expect((await bob.balance()).ledgerBalanceMinor).toBe(0);
    expect((await alice.history()).find((t) => t.id === txId)!.status).toBe("REVERSED");
    expect(trialBalance(h.ctx).balanced).toBe(true);
  });

  it("fails a reversal cleanly when the recipient has already spent the funds", async () => {
    const h = harness();
    const alice = await h.customer("+221700000211");
    const bob = await h.customer("+221700000212");
    const carol = await h.customer("+221700000213");
    await alice.fund(50_000);
    const txId = (await h.p2p(alice, bob, 10_000)).body.transaction.id;
    await h.p2p(bob, carol, 10_000);
    const maker = await h.staff("supervisor");
    const approvalId = (await maker("post", "/v1/admin/approvals", { action: "REVERSAL", payload: { transactionId: txId }, reason: "Disputed by the sender" })).body.approval.approvalId;
    const decided = await (await h.staff("supervisor2"))("post", `/v1/admin/approvals/${approvalId}/approve`, {});
    expect(decided.body.approval.status).toBe("FAILED");
    expect(decided.body.approval.failureReason).toMatch(/no longer holds enough/);
    expect((await bob.balance()).ledgerBalanceMinor).toBe(0);
    expect(trialBalance(h.ctx).balanced).toBe(true);
  });

  it("resolves a customer dispute through a four-eyes reversal", async () => {
    const h = harness();
    const alice = await h.customer("+221700000221");
    await alice.fund(20_000);
    const txId = (await alice.call("post", "/v1/payments/merchant", { idempotencyKey: h.key(), pin: PIN, merchantCode: "SN900100", amountMinor: 5_000 })).body.transaction.id;
    const dispute = await alice.call("post", "/v1/disputes", { transactionId: txId, reason: "Charged twice for one purchase" });
    expect(dispute.status).toBe(201);
    expect((await alice.call("post", "/v1/disputes", { transactionId: txId, reason: "Charged twice for one purchase" })).status).toBe(409);

    const analyst = await h.staff("analyst");
    await analyst("post", `/v1/admin/disputes/${dispute.body.dispute.disputeId}/request-reversal`, { reason: "Merchant confirmed duplicate charge" });
    const approvalId = (await analyst("get", "/v1/admin/approvals?status=PENDING")).body.approvals[0].approvalId;
    await (await h.staff("supervisor"))("post", `/v1/admin/approvals/${approvalId}/approve`, {});
    expect((await alice.call("get", "/v1/disputes")).body.disputes[0].status).toBe("RESOLVED_REVERSED");
    expect((await alice.balance()).ledgerBalanceMinor).toBe(20_000);
  });

  it("freezes immediately but needs a second person to unfreeze, and never unfreezes a confirmed sanctions match", async () => {
    const h = harness();
    const bob = await h.customer("+221700000231");
    const analyst = await h.staff("analyst");
    expect((await analyst("post", `/v1/admin/users/${bob.userId}/freeze`, { reason: "Reported lost phone" })).status).toBe(204);
    expect((await bob.call("get", "/v1/me")).status).toBe(401); // sessions revoked on freeze

    const approval = await analyst("post", "/v1/admin/approvals", { action: "UNFREEZE", payload: { userId: bob.userId }, reason: "Customer verified in branch" });
    await (await h.staff("supervisor"))("post", `/v1/admin/approvals/${approval.body.approval.approvalId}/approve`, {});
    const status = all<{ status: string }>(h.ctx.db, "SELECT status FROM users WHERE id = ?", bob.userId)[0].status;
    expect(status).toBe("ACTIVE");

    const dan = await h.customer("+221700000232", { fullName: "Viktor Blackwood", dateOfBirth: "1968-03-14" });
    const refused = await analyst("post", "/v1/admin/approvals", { action: "UNFREEZE", payload: { userId: dan.userId }, reason: "Please unfreeze this account" });
    expect(refused.status).toBe(403);
  });

  it("posts manual adjustments against suspense only after approval", async () => {
    const h = harness();
    const alice = await h.customer("+221700000241");
    const maker = await h.staff("supervisor");
    const approval = await maker("post", "/v1/admin/approvals", { action: "MANUAL_ADJUSTMENT", payload: { userId: alice.userId, amountMinor: 5_000 }, reason: "Goodwill credit for outage" });
    expect((await alice.balance()).ledgerBalanceMinor).toBe(0);
    await (await h.staff("admin"))("post", `/v1/admin/approvals/${approval.body.approval.approvalId}/approve`, {});
    expect((await alice.balance()).ledgerBalanceMinor).toBe(5_000);
    expect((await alice.history())[0]).toMatchObject({ type: "ADJUSTMENT", direction: "CREDIT" });
    expect(trialBalance(h.ctx).balanced).toBe(true);
  });
});

describe("reconciliation, webhooks and audit", () => {
  it("categorizes every reconciliation break against the provider's settlement report", async () => {
    const h = harness();
    const alice = await h.customer("+221700000251");
    await alice.fund(200_000);
    for (const suffix of ["1234", "9999", "8888", "5555"]) {
      const res = await alice.call("post", "/v1/transfers/mobile-money", {
        idempotencyKey: h.key(),
        pin: PIN,
        providerId: "WAVE",
        destinationPhoneNumber: `+22177123${suffix}`,
        amountMinor: 5_000,
      });
      expect(res.status).toBe(201);
    }
    await runSettlementOnce(h.ctx);
    const ops = await h.staff("analyst");
    const run = (await ops("post", "/v1/admin/reconciliation/run")).body.runs.find((r: { providerId: string }) => r.providerId === "WAVE");
    expect(run.matched).toBe(1);
    const exceptions = (await ops("get", `/v1/reconciliation/exceptions?runId=${run.runId}`)).body.exceptions;
    expect(exceptions.map((e: { category: string }) => e.category).sort()).toEqual([
      "AMOUNT_MISMATCH",
      "DUPLICATE_SETTLEMENT_ENTRY",
      "STATUS_MISMATCH",
    ]);
    expect((await ops("get", "/v1/reconciliation/settlements")).body.runs.length).toBeGreaterThan(0);
  });

  it("accepts only signed, fresh, non-replayed provider webhooks", async () => {
    const h = harness();
    const alice = await h.customer("+221700000261");
    await alice.fund(50_000);
    const tx = (await alice.call("post", "/v1/transfers/mobile-money", { idempotencyKey: h.key(), pin: PIN, providerId: "WAVE", destinationPhoneNumber: "+221771231234", amountMinor: 1_000 })).body.transaction;
    const providerRef = all<{ provider_ref: string }>(h.ctx.db, "SELECT provider_ref FROM transactions WHERE id = ?", tx.id)[0].provider_ref;
    const ts = String(Math.floor(h.clock.now().getTime() / 1000));
    const raw = JSON.stringify({ eventId: "evt_0001", providerRef, status: "SUCCESS" });
    const post = (signature: string, timestamp = ts) =>
      request(h.app)
        .post("/v1/webhooks/providers/WAVE")
        .set("content-type", "application/json")
        .set("x-benki-timestamp", timestamp)
        .set("x-benki-signature", signature)
        .send(raw);

    expect((await post("deadbeef")).status).toBe(401);
    const stale = String(Number(ts) - 3600);
    expect((await post(webhookSignature(h.ctx.config.webhookSecret, stale, raw), stale)).status).toBe(401);
    const ok = await post(webhookSignature(h.ctx.config.webhookSecret, ts, raw));
    expect(ok.body.status).toBe("accepted");
    expect((await alice.history())[0].status).toBe("COMPLETED");
    expect((await post(webhookSignature(h.ctx.config.webhookSecret, ts, raw))).body.status).toBe("duplicate_ignored");
  });

  it("detects tampering with the hash-chained audit log", async () => {
    const h = harness();
    const alice = await h.customer("+221700000271");
    await alice.fund(10_000);
    const supervisor = await h.staff("supervisor");
    expect((await supervisor("get", "/v1/admin/audit/verify")).body.valid).toBe(true);

    // Simulate an attacker with raw database access who disables the guard.
    h.ctx.db.exec("DROP TRIGGER audit_immutable_update");
    h.ctx.db.exec("UPDATE audit_log SET details = '{\"amountMinor\":1}' WHERE seq = 3");
    const verdict = (await supervisor("get", "/v1/admin/audit/verify")).body;
    expect(verdict).toMatchObject({ valid: false, firstBrokenSeq: 3 });
  });
});

describe("back-office access control", () => {
  it("locks staff out after repeated failed sign-ins", async () => {
    const h = harness();
    for (let i = 0; i < 5; i++) {
      expect((await request(h.app).post("/v1/admin/login").send({ username: "analyst", password: "wrong" })).status).toBe(401);
    }
    const locked = await request(h.app).post("/v1/admin/login").send({ username: "analyst", password: STAFF_PASSWORD });
    expect(locked.status).toBe(401);
    expect(locked.body.error.message).toMatch(/locked/);
  });

  it("enforces roles and keeps customer tokens out of the back office", async () => {
    const h = harness();
    const alice = await h.customer("+221700000281");
    expect((await alice.call("get", "/v1/admin/dashboard")).status).toBe(401);
    const analyst = await h.staff("analyst");
    expect((await analyst("get", "/v1/admin/audit")).status).toBe(403);
    expect((await analyst("get", "/v1/admin/dashboard")).status).toBe(200);
  });

  it("masks national IDs for analysts, reveals them to supervisors, and logs every record view", async () => {
    const h = harness();
    const alice = await h.customer("+221700000291");
    const analystView = (await (await h.staff("analyst"))("get", `/v1/admin/users/${alice.userId}`)).body.user;
    expect(analystView.nationalId).toBe("••••0291");
    const supervisor = await h.staff("supervisor");
    expect((await supervisor("get", `/v1/admin/users/${alice.userId}`)).body.user.nationalId).toBe("ID221700000291");
    const views = (await supervisor("get", `/v1/admin/audit?entityId=${alice.userId}`)).body.entries.filter((e: { action: string }) => e.action === "CUSTOMER_RECORD_VIEWED");
    expect(views).toHaveLength(2);
  });
});
