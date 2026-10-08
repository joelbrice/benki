import { COUNTRY_BY_CODE, type OtpSendResponse, type OtpVerifyResponse } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { all, one, run } from "../db/query";
import type { SessionRow, UserRow } from "../db/rows";
import { hmacHex, randomDigits, randomToken, safeEqual, sha256Hex } from "../lib/crypto";
import { badRequest, rateLimited, unauthorized } from "../lib/errors";
import { newId } from "../lib/ids";
import { audit } from "./audit";
import { notify } from "./notifications";
import { getUser, getUserByPhone, toUserProfile } from "./users";

const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 30_000;
const OTP_MAX_SENDS_PER_HOUR = 5;

interface OtpRow {
  phone: string;
  country_code: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  last_sent_at: string;
  window_start: string;
  window_count: number;
}

function otpHash(ctx: AppContext, phone: string, code: string) {
  return hmacHex(ctx.config.dataKey, `otp:${phone}:${code}`);
}

export function requestOtp(ctx: AppContext, phone: string, countryCode: string): OtpSendResponse {
  const country = COUNTRY_BY_CODE[countryCode];
  if (!country) throw badRequest(`Unsupported country ${countryCode}`);
  if (!phone.startsWith(country.callingCode)) {
    throw badRequest(`Phone numbers in ${country.name} start with ${country.callingCode}`);
  }
  const existing = getUserByPhone(ctx, phone);
  if (existing?.status === "CLOSED") throw unauthorized("This account is closed. Please contact support.");

  const now = ctx.now();
  const row = one<OtpRow>(ctx.db, "SELECT * FROM otps WHERE phone = ?", phone);
  if (row) {
    const sinceLast = now.getTime() - new Date(row.last_sent_at).getTime();
    if (sinceLast < OTP_RESEND_COOLDOWN_MS) {
      throw rateLimited(`Please wait ${Math.ceil((OTP_RESEND_COOLDOWN_MS - sinceLast) / 1000)}s before requesting another code`);
    }
  }
  const windowActive = row && now.getTime() - new Date(row.window_start).getTime() < 60 * 60 * 1000;
  if (windowActive && row.window_count >= OTP_MAX_SENDS_PER_HOUR) {
    throw rateLimited("Too many codes requested for this number. Try again in an hour.");
  }

  const code = randomDigits(6);
  run(
    ctx.db,
    `INSERT INTO otps (phone, country_code, code_hash, expires_at, attempts, last_sent_at, window_start, window_count)
     VALUES (?, ?, ?, ?, 0, ?, ?, 1)
     ON CONFLICT (phone) DO UPDATE SET
       country_code = excluded.country_code, code_hash = excluded.code_hash, expires_at = excluded.expires_at,
       attempts = 0, last_sent_at = excluded.last_sent_at,
       window_start = ?, window_count = ?`,
    phone,
    existing?.country_code ?? countryCode,
    otpHash(ctx, phone, code),
    new Date(now.getTime() + ctx.config.otpTtlMs).toISOString(),
    now.toISOString(),
    now.toISOString(),
    windowActive ? row.window_start : now.toISOString(),
    windowActive ? row.window_count + 1 : 1,
  );

  // A real deployment hands `code` to an SMS gateway here.
  return {
    requestId: newId("OTP"),
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
    ...(ctx.config.exposeDevOtp ? { devOtp: code } : {}),
  };
}

export function verifyOtp(ctx: AppContext, phone: string, code: string, deviceId: string): OtpVerifyResponse {
  const row = one<OtpRow>(ctx.db, "SELECT * FROM otps WHERE phone = ?", phone);
  if (!row || new Date(row.expires_at) <= ctx.now()) throw unauthorized("Code expired or invalid. Request a new one.");
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    run(ctx.db, "DELETE FROM otps WHERE phone = ?", phone);
    throw unauthorized("Too many attempts. Request a new code.");
  }
  if (!safeEqual(otpHash(ctx, phone, code), row.code_hash)) {
    // Deliberately outside any transaction so the failed attempt is counted.
    run(ctx.db, "UPDATE otps SET attempts = attempts + 1 WHERE phone = ?", phone);
    const remaining = OTP_MAX_ATTEMPTS - row.attempts - 1;
    throw unauthorized(remaining > 0 ? `Incorrect code. ${remaining} attempts left.` : "Too many attempts. Request a new code.");
  }

  return withTx(ctx.db, () => {
    run(ctx.db, "DELETE FROM otps WHERE phone = ?", phone);
    const now = ctx.nowIso();
    let user = getUserByPhone(ctx, phone);
    if (!user) {
      const id = newId("USR");
      run(ctx.db, "INSERT INTO users (id, phone, country_code, created_at) VALUES (?, ?, ?, ?)", id, phone, row.country_code, now);
      user = getUser(ctx, id)!;
      audit(ctx, { actorType: "USER", actorId: id, action: "USER_REGISTERED", entityType: "user", entityId: id, details: { countryCode: row.country_code } });
    }

    const knownDevices = all<{ device_id: string }>(ctx.db, "SELECT device_id FROM devices WHERE user_id = ?", user.id);
    const isNewDevice = !knownDevices.some((d) => d.device_id === deviceId);
    if (isNewDevice) {
      run(ctx.db, "INSERT INTO devices (user_id, device_id, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)", user.id, deviceId, now, now);
      if (knownDevices.length > 0) {
        notify(ctx, user.id, "SECURITY", "New device signed in to your account. If this wasn't you, contact support immediately.");
        audit(ctx, { actorType: "USER", actorId: user.id, action: "NEW_DEVICE_SIGN_IN", entityType: "user", entityId: user.id, details: {} });
      }
    } else {
      run(ctx.db, "UPDATE devices SET last_seen_at = ? WHERE user_id = ? AND device_id = ?", now, user.id, deviceId);
    }

    const token = `bk_${randomToken()}`;
    const expiresAt = new Date(ctx.now().getTime() + ctx.config.sessionTtlMs).toISOString();
    run(
      ctx.db,
      "INSERT INTO sessions (token_hash, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
      sha256Hex(token),
      user.id,
      deviceId,
      now,
      expiresAt,
    );
    audit(ctx, { actorType: "USER", actorId: user.id, action: "SIGNED_IN", entityType: "user", entityId: user.id, details: { newDevice: isNewDevice } });
    return { token, expiresAt, user: toUserProfile(user) };
  });
}

export function authenticate(ctx: AppContext, token: string, deviceId: string | undefined): { user: UserRow; session: SessionRow } {
  const session = one<SessionRow>(ctx.db, "SELECT * FROM sessions WHERE token_hash = ?", sha256Hex(token));
  if (!session || session.revoked || new Date(session.expires_at) <= ctx.now()) {
    throw unauthorized("Your session has expired. Please sign in again.");
  }
  // Session tokens are bound to the device that signed in.
  if (deviceId && deviceId !== session.device_id) throw unauthorized("This session isn't valid on this device.");
  const user = getUser(ctx, session.user_id);
  if (!user || user.status === "CLOSED") throw unauthorized();
  return { user, session };
}

export function logout(ctx: AppContext, token: string) {
  run(ctx.db, "UPDATE sessions SET revoked = 1 WHERE token_hash = ?", sha256Hex(token));
}

export function revokeAllSessions(ctx: AppContext, userId: string) {
  run(ctx.db, "UPDATE sessions SET revoked = 1 WHERE user_id = ?", userId);
}

export function deviceFirstSeen(ctx: AppContext, userId: string, deviceId: string): Date | null {
  const row = one<{ first_seen_at: string }>(
    ctx.db,
    "SELECT first_seen_at FROM devices WHERE user_id = ? AND device_id = ?",
    userId,
    deviceId,
  );
  return row ? new Date(row.first_seen_at) : null;
}
