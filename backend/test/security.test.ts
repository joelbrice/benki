import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { MINUTE } from "../src/lib/clock";
import { harness } from "./harness";

describe("authentication hardening", () => {
  it("invalidates an OTP after five wrong attempts", async () => {
    const h = harness();
    const phone = "+221700000301";
    const sent = await request(h.app).post("/v1/auth/otp/send").send({ phoneNumber: phone, countryCode: "SN" });
    const wrong = sent.body.devOtp === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) {
      expect((await request(h.app).post("/v1/auth/otp/verify").set("x-device-id", "device-x-0001").send({ phoneNumber: phone, otp: wrong })).status).toBe(401);
    }
    const correct = await request(h.app).post("/v1/auth/otp/verify").set("x-device-id", "device-x-0001").send({ phoneNumber: phone, otp: sent.body.devOtp });
    expect(correct.status).toBe(401);
  });

  it("rate-limits OTP sends per number and expires codes", async () => {
    const h = harness();
    const send = () => request(h.app).post("/v1/auth/otp/send").send({ phoneNumber: "+221700000302", countryCode: "SN" });
    const first = await send();
    expect(first.status).toBe(200);
    expect((await send()).status).toBe(429);
    h.clock.advance(6 * MINUTE);
    const expired = await request(h.app).post("/v1/auth/otp/verify").set("x-device-id", "device-x-0002").send({ phoneNumber: "+221700000302", otp: first.body.devOtp });
    expect(expired.status).toBe(401);
    for (let i = 0; i < 4; i++) {
      expect((await send()).status).toBe(200);
      h.clock.advance(31_000);
    }
    expect((await send()).body.error.message).toMatch(/Too many codes/);
  });

  it("validates that the phone number belongs to the chosen country", async () => {
    const h = harness();
    const res = await request(h.app).post("/v1/auth/otp/send").send({ phoneNumber: "+254700000303", countryCode: "SN" });
    expect(res.status).toBe(400);
  });

  it("binds sessions to the device that signed in", async () => {
    const h = harness();
    const alice = await h.customer("+221700000304");
    expect((await alice.call("get", "/v1/me")).status).toBe(200);
    expect((await alice.call("get", "/v1/me", undefined, "stolen-token-device")).status).toBe(401);
  });

  it("expires sessions", async () => {
    const h = harness();
    const alice = await h.customer("+221700000305");
    h.clock.advance(13 * 60 * MINUTE);
    expect((await alice.call("get", "/v1/me")).status).toBe(401);
  });
});

describe("platform guardrails", () => {
  it("refuses to boot in production with development secrets or demo shortcuts", () => {
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/Unsafe production configuration/);
    const key = Buffer.alloc(32, 7).toString("base64");
    expect(() =>
      loadConfig({
        NODE_ENV: "production",
        BENKI_DATA_KEY: key,
        BENKI_WEBHOOK_SECRET: "a-real-secret",
        BENKI_USSD_GATEWAY_KEY: "a-real-gateway-key",
        BENKI_CORS_ORIGINS: "https://app.benki.example",
      }),
    ).not.toThrow();
  });

  it("sends security headers, hides the framework, and caps request size", async () => {
    const h = harness();
    const res = await request(h.app).get("/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-correlation-id"]).toBeTruthy();

    const big = await request(h.app).post("/v1/auth/otp/send").send({ phoneNumber: "+221700000306", countryCode: "SN", pad: "x".repeat(20_000) });
    expect(big.status).toBe(413);
  });

  it("only allows configured browser origins", async () => {
    const h = harness();
    const evil = await request(h.app).get("/v1/health").set("origin", "https://evil.example");
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
    const ok = await request(h.app).get("/v1/health").set("origin", "http://localhost:5173");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("validates money amounts strictly", async () => {
    const h = harness();
    const alice = await h.customer("+221700000307");
    for (const amountMinor of [-5, 0, 1.5, "100", 2 ** 60]) {
      const res = await alice.call("post", `/v1/wallets/${alice.walletId}/cash-in`, { idempotencyKey: h.key(), agentId: "SN-01", amountMinor });
      expect(res.status).toBe(400);
    }
  });

  it("returns JSON errors with a correlation ID for unknown routes", async () => {
    const h = harness();
    const res = await request(h.app).get("/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.correlationId).toBe(res.headers["x-correlation-id"]);
  });
});
