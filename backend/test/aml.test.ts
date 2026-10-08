import request from "supertest";
import { describe, expect, it } from "vitest";
import { all } from "../src/db/query";
import { DAY } from "../src/lib/clock";
import { harness, PIN } from "./harness";

const ruleCodes = (tx: { ruleHits: { code: string }[] }) => tx.ruleHits.map((r) => r.code);

describe("sanctions and PEP screening", () => {
  it("freezes a confirmed sanctions match and raises a critical alert, without telling the customer why", async () => {
    const h = harness();
    const dan = await h.customer("+221700000101", { fullName: "Viktor Blackwood", dateOfBirth: "1968-03-14" });
    const me = (await dan.call("get", "/v1/me")).body.user;
    expect(me.status).toBe("FROZEN");
    expect(me.kycTier).toBe("TIER_0");
    const admin = await h.staff("analyst");
    const alerts = (await admin("get", "/v1/admin/alerts?status=OPEN")).body.alerts;
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ kind: "SCREENING", severity: "CRITICAL" });
    expect(alerts[0].rules[0].code).toBe("SANCTIONS_CONFIRMED_MATCH");

    const notes = (await dan.call("get", "/v1/notifications")).body.notifications.map((n: { message: string }) => n.message).join(" ");
    expect(notes).not.toMatch(/sanction|watchlist|match/i);
    const pay = await dan.call("post", `/v1/wallets/${dan.walletId}/cash-in`, { idempotencyKey: h.key(), agentId: "SN-01", amountMinor: 1_000 });
    expect(pay.body.error.code).toBe("ACCOUNT_RESTRICTED");
  });

  it("parks a potential match for review; only a supervisor can clear it", async () => {
    const h = harness();
    const near = await h.customer("+221700000102", { fullName: "Viktor Blackwod", dateOfBirth: "1980-01-01" });
    const me = (await near.call("get", "/v1/me")).body.user;
    expect(me).toMatchObject({ status: "ACTIVE", kycTier: "TIER_0", kycReviewPending: true });

    const analyst = await h.staff("analyst");
    const alertId = (await analyst("get", "/v1/admin/alerts?status=OPEN")).body.alerts[0].alertId;
    const denied = await analyst("post", `/v1/admin/alerts/${alertId}/screening`, { decision: "CLEAR", note: "Different DOB and nationality" });
    expect(denied.status).toBe(403);

    const supervisor = await h.staff("supervisor");
    expect((await supervisor("post", `/v1/admin/alerts/${alertId}/screening`, { decision: "CLEAR", note: "Different DOB and nationality" })).status).toBe(204);
    expect((await near.call("get", "/v1/me")).body.user).toMatchObject({ kycTier: "TIER_1", kycReviewPending: false });
  });

  it("treats PEPs as enhanced due diligence, never as an automatic block", async () => {
    const h = harness();
    const pep = await h.customer("+221700000103", { fullName: "Octavia Sterling Vance", dateOfBirth: "1961-07-21" });
    expect((await pep.call("get", "/v1/me")).body.user).toMatchObject({ status: "ACTIVE", kycReviewPending: true });
  });

  it("rejects a second account using the same national ID", async () => {
    const h = harness();
    await h.customer("+221700000104");
    const other = await h.customer("+221700000105", { tier: 0 });
    const dup = await other.call("post", "/v1/kyc/tier1", { fullName: "Someone Else", dateOfBirth: "1991-01-01", nationalId: "ID221700000104" });
    expect(dup.status).toBe(409);
  });
});

describe("transaction monitoring", () => {
  it("blocks payments to a restricted counterparty, records the attempt, and shows the sender only a generic failure", async () => {
    const h = harness();
    const alice = await h.customer("+221700000111");
    const dan = await h.customer("+221700000112", { fullName: "Viktor Blackwood", dateOfBirth: "1968-03-14" });
    await alice.fund(50_000);
    const res = await h.p2p(alice, dan, 1_000);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("COMPLIANCE_BLOCK");
    expect(res.body.error.message).not.toMatch(/sanction|frozen|restricted counterparty/i);
    expect((await alice.balance()).ledgerBalanceMinor).toBe(50_000);
    expect((await alice.history())[0].status).toBe("FAILED");

    const admin = await h.staff("supervisor");
    const blocked = (await admin("get", "/v1/admin/transactions?status=BLOCKED")).body.transactions;
    expect(blocked).toHaveLength(1);
    expect(ruleCodes(blocked[0])).toContain("RESTRICTED_COUNTERPARTY");
  });

  it("holds structured cash deposits just under the threshold", async () => {
    const h = harness();
    const alice = await h.customer("+221700000121"); // SN Tier 1 per-transaction limit: 500,000
    const cashIn = () => alice.call("post", `/v1/wallets/${alice.walletId}/cash-in`, { idempotencyKey: h.key(), agentId: "SN-02", amountMinor: 450_000 });
    expect((await cashIn()).status).toBe(201);
    h.clock.advance(2 * DAY);
    await alice.signIn();
    expect((await cashIn()).status).toBe(201);
    h.clock.advance(2 * DAY);
    await alice.signIn();
    const third = await cashIn();
    expect(third.status).toBe(202);
    expect(third.body.transaction.status).toBe("PENDING_REVIEW");
    expect((await alice.balance()).ledgerBalanceMinor).toBe(900_000);
    const admin = await h.staff("analyst");
    expect(ruleCodes((await admin("get", "/v1/admin/transactions?status=PENDING_REVIEW")).body.transactions[0])).toContain("STRUCTURING");
  });

  it("holds the payment that breaks the hourly velocity threshold and reserves its funds", async () => {
    const h = harness();
    const alice = await h.customer("+221700000131");
    const bob = await h.customer("+221700000132");
    await alice.fund(100_000);
    for (let i = 0; i < 5; i++) expect((await h.p2p(alice, bob, 1_000)).status).toBe(201);
    const sixth = await h.p2p(alice, bob, 1_000);
    expect(sixth.status).toBe(202);
    expect(sixth.body.message).toMatch(/being processed/);
    expect(sixth.body.wallet).toMatchObject({ ledgerBalanceMinor: 95_000, reservedBalanceMinor: 1_000, availableBalanceMinor: 94_000 });
  });

  it("flags rapid pass-through of freshly received funds (money mule pattern)", async () => {
    const h = harness();
    const alice = await h.customer("+221700000141");
    const mule = await h.customer("+221700000142");
    const carol = await h.customer("+221700000143");
    await alice.fund(1_000_000);
    expect((await h.p2p(alice, mule, 400_000)).status).toBe(201);
    const out = await h.p2p(mule, carol, 350_000);
    expect(out.status).toBe(202);
    const admin = await h.staff("analyst");
    const held = (await admin("get", "/v1/admin/transactions?status=PENDING_REVIEW")).body.transactions[0];
    expect(ruleCodes(held)).toContain("RAPID_PASS_THROUGH");
  });

  it("holds outgoing payments after a recent SIM swap", async () => {
    const h = harness();
    const swapped = await h.customer("+221700000177");
    const bob = await h.customer("+221700000152");
    await swapped.fund(10_000);
    expect((await h.p2p(swapped, bob, 500)).status).toBe(202);
  });

  it("holds a high-value payment from a newly added device on an established account", async () => {
    const h = harness();
    const alice = await h.customer("+221700000161");
    const bob = await h.customer("+221700000162");
    await alice.fund(400_000);
    h.clock.advance(3 * DAY);
    const otp = await request(h.app).post("/v1/auth/otp/send").send({ phoneNumber: alice.phone, countryCode: "SN" });
    const login = await request(h.app).post("/v1/auth/otp/verify").set("x-device-id", "brand-new-device").send({ phoneNumber: alice.phone, otp: otp.body.devOtp });
    const res = await request(h.app)
      .post("/v1/transfers/internal")
      .set("authorization", `Bearer ${login.body.token}`)
      .set("x-device-id", "brand-new-device")
      .send({ idempotencyKey: h.key(), pin: PIN, destinationPhoneNumber: bob.phone, amountMinor: 300_000 });
    expect(res.status).toBe(202);
    await alice.signIn();
    const notes = (await alice.call("get", "/v1/notifications")).body.notifications;
    expect(notes.some((n: { kind: string; message: string }) => n.kind === "SECURITY" && /New device/.test(n.message))).toBe(true);
  });

  it("holds a large payment from an account dormant for 90+ days", async () => {
    const h = harness();
    const alice = await h.customer("+221700000171");
    const bob = await h.customer("+221700000172");
    await alice.fund(300_000);
    h.clock.advance(91 * DAY);
    await alice.signIn();
    const res = await h.p2p(alice, bob, 200_000);
    expect(res.status).toBe(202);
    const admin = await h.staff("analyst");
    expect(ruleCodes((await admin("get", "/v1/admin/transactions?status=PENDING_REVIEW")).body.transactions[0])).toContain("DORMANT_REACTIVATION");
  });
});

describe("compliance case workflow", () => {
  async function heldPayment() {
    const h = harness();
    const alice = await h.customer("+221700000181");
    const bob = await h.customer("+221700000182");
    await alice.fund(100_000);
    for (let i = 0; i < 5; i++) await h.p2p(alice, bob, 1_000);
    const held = await h.p2p(alice, bob, 2_000);
    return { h, alice, bob, txId: held.body.transaction.id as string };
  }

  it("requires a supervisor to release held funds; release posts the payment", async () => {
    const { h, alice, bob, txId } = await heldPayment();
    const analyst = await h.staff("analyst");
    expect((await analyst("post", `/v1/admin/transactions/${txId}/approve`)).status).toBe(403);
    const supervisor = await h.staff("supervisor");
    const approved = await supervisor("post", `/v1/admin/transactions/${txId}/approve`);
    expect(approved.body.transaction.status).toBe("COMPLETED");
    expect(await alice.balance()).toMatchObject({ ledgerBalanceMinor: 93_000, reservedBalanceMinor: 0 });
    expect((await bob.balance()).ledgerBalanceMinor).toBe(7_000);
  });

  it("releases reserved funds when a held payment is rejected, showing the customer only a generic failure", async () => {
    const { h, alice, txId } = await heldPayment();
    const analyst = await h.staff("analyst");
    expect((await analyst("post", `/v1/admin/transactions/${txId}/reject`, { reason: "Customer could not explain the pattern" })).status).toBe(200);
    expect(await alice.balance()).toMatchObject({ ledgerBalanceMinor: 95_000, availableBalanceMinor: 95_000, reservedBalanceMinor: 0 });
    const tx = (await alice.history()).find((t) => t.id === txId)!;
    expect(tx.status).toBe("FAILED");
  });

  it("files a suspicious transaction report without notifying the subject", async () => {
    const { h, alice, txId } = await heldPayment();
    const analyst = await h.staff("analyst");
    const caseId = (await analyst("get", "/v1/admin/cases?status=OPEN")).body.cases[0].caseId;
    expect((await analyst("post", `/v1/admin/cases/${caseId}/close`, { resolution: "Looks fine to me overall" })).status).toBe(409);
    await analyst("post", `/v1/admin/transactions/${txId}/reject`, { reason: "Pattern consistent with smurfing" });
    expect((await analyst("post", `/v1/admin/cases/${caseId}/str`, { narrative: "x".repeat(40) })).status).toBe(403);

    const supervisor = await h.staff("supervisor");
    expect((await supervisor("post", `/v1/admin/cases/${caseId}/str`, { narrative: "too short" })).status).toBe(400);
    const notesBefore = (await alice.call("get", "/v1/notifications")).body.notifications.length;
    const filed = await supervisor("post", `/v1/admin/cases/${caseId}/str`, {
      narrative: "Six rapid transfers to one counterparty within an hour; customer unable to explain the source of funds.",
    });
    expect(filed.status).toBe(201);
    expect(filed.body.str.reference).toMatch(/^STR-SN-\d{8}-\d{6}$/);
    expect(filed.body.str.payload.subject).toMatchObject({ fullName: "Amina Diallo", nationalId: "ID221700000181" });
    expect(filed.body.str.payload.indicators.map((i: { code: string }) => i.code)).toContain("VELOCITY_HOURLY");
    expect((await supervisor("get", `/v1/admin/cases/${caseId}`)).body.case.status).toBe("CLOSED_STR_FILED");
    expect((await alice.call("get", "/v1/notifications")).body.notifications.length).toBe(notesBefore);
  });

  it("stores the national ID encrypted at rest", async () => {
    const h = harness();
    await h.customer("+221700000191");
    const row = all<{ national_id_enc: string; national_id_hash: string }>(h.ctx.db, "SELECT national_id_enc, national_id_hash FROM users WHERE phone = '+221700000191'")[0];
    expect(row.national_id_enc).toMatch(/^v1:/);
    expect(row.national_id_enc).not.toContain("221700000191");
    expect(row.national_id_hash).not.toContain("221700000191");
  });
});
