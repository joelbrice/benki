import request from "supertest";
import { COUNTRY_BY_CODE } from "@benki/shared";
import { createApp } from "../src/app";
import { createContext, type AppContext } from "../src/context";
import { HOUR, ManualClock } from "../src/lib/clock";
import { seedMarkets } from "../src/services/seed";

export const PIN = "7391";
export const STAFF_PASSWORD = "Benki-Demo-2026!";

export interface Customer {
  phone: string;
  device: string;
  token: string;
  /** Sessions expire after 12h; tests that move the clock further sign in again. */
  signIn(): Promise<void>;
  userId: string;
  walletId: string;
  call(method: "get" | "post", path: string, body?: object, device?: string): request.Test;
  fund(amountMinor: number): Promise<void>;
  balance(): Promise<{ ledgerBalanceMinor: number; availableBalanceMinor: number; reservedBalanceMinor: number }>;
  history(): Promise<{ id: string; type: string; status: string; direction: string; amountMinor: number }[]>;
}

export interface CustomerOptions {
  country?: string;
  tier?: 0 | 1 | 2;
  fullName?: string;
  dateOfBirth?: string;
  pin?: string | null;
  device?: string;
}

export function harness() {
  const clock = new ManualClock("2026-03-02T08:00:00.000Z");
  const ctx: AppContext = createContext({ env: { NODE_ENV: "test" }, clock, silent: true });
  seedMarkets(ctx);
  const app = createApp(ctx);
  let seq = 0;
  const key = () => `test-key-${++seq}`;

  async function customer(phone: string, options: CustomerOptions = {}): Promise<Customer> {
    const country = options.country ?? "SN";
    const device = options.device ?? `device-${phone.replace(/\D/g, "")}`;
    const login = async () => {
      const sent = await request(app).post("/v1/auth/otp/send").send({ phoneNumber: phone, countryCode: country });
      if (sent.status !== 200) throw new Error(`otp send failed: ${JSON.stringify(sent.body)}`);
      const verified = await request(app)
        .post("/v1/auth/otp/verify")
        .set("x-device-id", device)
        .send({ phoneNumber: phone, otp: sent.body.devOtp });
      if (verified.status !== 200) throw new Error(`otp verify failed: ${JSON.stringify(verified.body)}`);
      return verified.body as { token: string; user: { userId: string } };
    };
    const verified = { body: await login() };
    let token: string = verified.body.token;

    const call = (method: "get" | "post", path: string, body?: object, deviceOverride?: string) => {
      const r = request(app)[method](path).set("authorization", `Bearer ${token}`).set("x-device-id", deviceOverride ?? device);
      return body ? r.send(body) : r;
    };

    const wallet = await call("post", "/v1/wallets");
    if (options.pin !== null) {
      const pin = await call("post", "/v1/me/pin", { pin: options.pin ?? PIN });
      if (pin.status !== 201) throw new Error(`pin failed: ${JSON.stringify(pin.body)}`);
    }
    const tier = options.tier ?? 1;
    if (tier >= 1) {
      const kyc = await call("post", "/v1/kyc/tier1", {
        fullName: options.fullName ?? "Amina Diallo",
        dateOfBirth: options.dateOfBirth ?? "1990-05-17",
        nationalId: `ID${phone.replace(/\D/g, "")}`,
      });
      if (kyc.status !== 200) throw new Error(`kyc failed: ${JSON.stringify(kyc.body)}`);
    }
    if (tier >= 2) await call("post", "/v1/kyc/tier2", { proofOfAddressConfirmed: true, livenessCheckPassed: true });

    const walletId: string = wallet.body.wallet.walletId;
    const agentId = COUNTRY_BY_CODE[country].agents[0].id;
    return {
      phone,
      device,
      get token() {
        return token;
      },
      async signIn() {
        token = (await login()).token;
      },
      userId: verified.body.user.userId,
      walletId,
      call,
      async fund(amountMinor: number) {
        const res = await call("post", `/v1/wallets/${walletId}/cash-in`, { idempotencyKey: key(), agentId, amountMinor });
        if (res.status !== 201) throw new Error(`fund failed: ${JSON.stringify(res.body)}`);
        // Step past the pass-through window so funding doesn't look like mule activity.
        clock.advance(2 * HOUR);
      },
      async balance() {
        return (await call("get", `/v1/wallets/${walletId}`)).body.wallet;
      },
      async history() {
        return (await call("get", `/v1/wallets/${walletId}/transactions`)).body.transactions;
      },
    };
  }

  async function staff(username: "analyst" | "supervisor" | "supervisor2" | "admin") {
    const res = await request(app).post("/v1/admin/login").send({ username, password: STAFF_PASSWORD });
    if (res.status !== 200) throw new Error(`staff login failed: ${JSON.stringify(res.body)}`);
    const token: string = res.body.token;
    return (method: "get" | "post", path: string, body?: object) => {
      const r = request(app)[method](path).set("authorization", `Bearer ${token}`);
      return body ? r.send(body) : r;
    };
  }

  const p2p = (from: Customer, to: Customer, amountMinor: number, extra: object = {}) =>
    from.call("post", "/v1/transfers/internal", {
      idempotencyKey: key(),
      pin: PIN,
      destinationPhoneNumber: to.phone,
      amountMinor,
      ...extra,
    });

  return { ctx, clock, app, key, customer, staff, p2p };
}
