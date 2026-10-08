import type { StaffLoginResponse, StaffRole } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { one, run } from "../db/query";
import type { StaffRow } from "../db/rows";
import { hashSecret, randomToken, sha256Hex, verifySecret } from "../lib/crypto";
import { unauthorized } from "../lib/errors";
import { newId } from "../lib/ids";
import { audit } from "./audit";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export const DEMO_STAFF: { username: string; role: StaffRole }[] = [
  { username: "analyst", role: "ANALYST" },
  { username: "supervisor", role: "SUPERVISOR" },
  { username: "supervisor2", role: "SUPERVISOR" },
  { username: "admin", role: "ADMIN" },
];

/** Development/demo only — loadConfig refuses BENKI_SEED_DEMO_STAFF in production. */
export function seedDemoStaff(ctx: AppContext) {
  if (!ctx.config.seedDemoStaff) return;
  for (const s of DEMO_STAFF) {
    if (one(ctx.db, "SELECT id FROM staff WHERE username = ?", s.username)) continue;
    run(
      ctx.db,
      "INSERT INTO staff (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
      newId("STF"),
      s.username,
      hashSecret(ctx.config.demoStaffPassword),
      s.role,
      ctx.nowIso(),
    );
  }
}

export function staffLogin(ctx: AppContext, username: string, password: string): StaffLoginResponse {
  const staff = one<StaffRow>(ctx.db, "SELECT * FROM staff WHERE username = ?", username);
  const generic = unauthorized("Invalid username or password");
  if (!staff || !staff.active) {
    verifySecret(password, hashSecret("timing-equalizer"));
    throw generic;
  }
  if (staff.locked_until && new Date(staff.locked_until) > ctx.now()) {
    throw unauthorized("Account temporarily locked after failed sign-ins. Try again later.");
  }
  if (!verifySecret(password, staff.password_hash)) {
    const failures = staff.failed_logins + 1;
    const lock = failures >= MAX_FAILED_LOGINS ? new Date(ctx.now().getTime() + LOCKOUT_MS).toISOString() : null;
    run(ctx.db, "UPDATE staff SET failed_logins = ?, locked_until = ? WHERE id = ?", lock ? 0 : failures, lock, staff.id);
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: lock ? "STAFF_LOCKED_OUT" : "STAFF_SIGN_IN_FAILED", entityType: "staff", entityId: staff.id });
    throw generic;
  }
  return withTx(ctx.db, () => {
    run(ctx.db, "UPDATE staff SET failed_logins = 0, locked_until = NULL WHERE id = ?", staff.id);
    const token = `bks_${randomToken()}`;
    const expiresAt = new Date(ctx.now().getTime() + ctx.config.staffSessionTtlMs).toISOString();
    run(
      ctx.db,
      "INSERT INTO staff_sessions (token_hash, staff_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      sha256Hex(token),
      staff.id,
      ctx.nowIso(),
      expiresAt,
    );
    audit(ctx, { actorType: "STAFF", actorId: staff.id, action: "STAFF_SIGNED_IN", entityType: "staff", entityId: staff.id });
    return { token, expiresAt, staff: { staffId: staff.id, username: staff.username, role: staff.role } };
  });
}

export function authenticateStaff(ctx: AppContext, token: string): StaffRow {
  const session = one<{ staff_id: string; expires_at: string; revoked: number }>(
    ctx.db,
    "SELECT staff_id, expires_at, revoked FROM staff_sessions WHERE token_hash = ?",
    sha256Hex(token),
  );
  if (!session || session.revoked || new Date(session.expires_at) <= ctx.now()) {
    throw unauthorized("Staff session expired. Please sign in again.");
  }
  const staff = one<StaffRow>(ctx.db, "SELECT * FROM staff WHERE id = ?", session.staff_id);
  if (!staff || !staff.active) throw unauthorized();
  return staff;
}

export function staffLogout(ctx: AppContext, token: string) {
  run(ctx.db, "UPDATE staff_sessions SET revoked = 1 WHERE token_hash = ?", sha256Hex(token));
}
