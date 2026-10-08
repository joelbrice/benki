import type { KycResponse, RuleHit } from "@benki/shared";
import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { one, run } from "../db/query";
import type { AlertRow, StaffRow, UserRow } from "../db/rows";
import { encryptField, hmacHex } from "../lib/crypto";
import { badRequest, conflict, notFound } from "../lib/errors";
import { audit } from "./audit";
import { raiseAlert, requireRole } from "./compliance";
import { notify } from "./notifications";
import { screenName } from "./screening";
import { assertActive, getUser, toUserProfile } from "./users";

const PENDING_MESSAGE = "Thanks — we're verifying your details. We'll notify you as soon as it's done.";

function ageOn(dateOfBirth: string, today: Date): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}

export function upgradeTier1(
  ctx: AppContext,
  userRow: UserRow,
  input: { fullName: string; dateOfBirth: string; nationalId: string },
): KycResponse {
  const user = getUser(ctx, userRow.id)!;
  assertActive(user);
  if (user.kyc_tier !== "TIER_0") throw conflict("Tier 1 verification is already complete");
  if (user.kyc_review_pending) throw conflict("Your verification is already being reviewed");

  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (!/^[\p{L}][\p{L}' .-]{1,99}$/u.test(fullName) || fullName.split(" ").length < 2) {
    throw badRequest("Enter your full legal name (first and last name)");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth) || Number.isNaN(Date.parse(input.dateOfBirth))) {
    throw badRequest("Date of birth must be YYYY-MM-DD");
  }
  const age = ageOn(input.dateOfBirth, ctx.now());
  if (age < 18) throw badRequest("You must be at least 18 to open a Benki account");
  if (age > 120) throw badRequest("Check your date of birth");

  const nationalId = input.nationalId.toUpperCase().replace(/[\s-]/g, "");
  if (!/^[A-Z0-9]{6,20}$/.test(nationalId)) throw badRequest("National ID must be 6–20 letters or digits");

  // Keyed hash for uniqueness lookups; the ID itself is stored encrypted.
  const idHash = hmacHex(ctx.config.dataKey, `nid:${user.country_code}:${nationalId}`);
  const duplicate = one<{ id: string }>(ctx.db, "SELECT id FROM users WHERE national_id_hash = ? AND id <> ?", idHash, user.id);
  if (duplicate) {
    audit(ctx, { actorType: "USER", actorId: user.id, action: "KYC_DUPLICATE_ID_ATTEMPT", entityType: "user", entityId: user.id, details: { existingUserId: duplicate.id } });
    throw conflict("This ID number is already linked to another Benki account. Contact support if this is a mistake.");
  }

  const screening = screenName(fullName, input.dateOfBirth);
  return withTx(ctx.db, () => {
    run(
      ctx.db,
      `UPDATE users SET full_name = ?, date_of_birth = ?, national_id_enc = ?, national_id_hash = ?, national_id_last4 = ?,
         screening_status = ?, screening_matches = ? WHERE id = ?`,
      fullName,
      input.dateOfBirth,
      encryptField(ctx.config.dataKey, nationalId),
      idHash,
      nationalId.slice(-4),
      screening.status,
      JSON.stringify(screening.matches),
      user.id,
    );

    const hits: RuleHit[] = screening.matches.map((m) => ({
      code: screening.status === "CONFIRMED_MATCH" ? "SANCTIONS_CONFIRMED_MATCH" : "WATCHLIST_POTENTIAL_MATCH",
      description: `${m.listName}: "${m.matchedName}" (similarity ${m.similarity})`,
      outcome: screening.status === "CONFIRMED_MATCH" ? "BLOCK" : "REVIEW",
      score: Math.round(m.similarity * 100),
    }));

    let message = "Verified — you're now Tier 1 with higher limits.";
    if (screening.status === "CLEAR") {
      run(ctx.db, "UPDATE users SET kyc_tier = 'TIER_1' WHERE id = ?", user.id);
      notify(ctx, user.id, "ACCOUNT", "Identity verified. Your limits have been raised to Tier 1.");
    } else if (screening.status === "POTENTIAL_MATCH") {
      run(ctx.db, "UPDATE users SET kyc_review_pending = 1 WHERE id = ?", user.id);
      raiseAlert(ctx, { kind: "SCREENING", userId: user.id, transactionId: null, severity: "HIGH", hits });
      message = PENDING_MESSAGE;
    } else {
      run(ctx.db, "UPDATE users SET status = 'FROZEN' WHERE id = ?", user.id);
      raiseAlert(ctx, { kind: "SCREENING", userId: user.id, transactionId: null, severity: "CRITICAL", hits });
      message = PENDING_MESSAGE;
    }
    audit(ctx, {
      actorType: "USER",
      actorId: user.id,
      action: "KYC_TIER1_SUBMITTED",
      entityType: "user",
      entityId: user.id,
      details: { screeningStatus: screening.status },
    });
    return { user: toUserProfile(getUser(ctx, user.id)!), message };
  });
}

export function upgradeTier2(
  ctx: AppContext,
  userRow: UserRow,
  input: { proofOfAddressConfirmed: boolean; livenessCheckPassed: boolean },
): KycResponse {
  const user = getUser(ctx, userRow.id)!;
  assertActive(user);
  if (user.kyc_tier === "TIER_2") throw conflict("Tier 2 verification is already complete");
  if (user.kyc_tier !== "TIER_1") throw badRequest("Complete Tier 1 verification first");
  if (!input.proofOfAddressConfirmed || !input.livenessCheckPassed) {
    throw badRequest("Tier 2 needs both a proof of address and a selfie liveness check");
  }
  return withTx(ctx.db, () => {
    run(ctx.db, "UPDATE users SET kyc_tier = 'TIER_2', proof_of_address = 1, liveness_passed = 1 WHERE id = ?", user.id);
    notify(ctx, user.id, "ACCOUNT", "Enhanced verification complete. You now have Tier 2 limits.");
    audit(ctx, { actorType: "USER", actorId: user.id, action: "KYC_TIER2_COMPLETED", entityType: "user", entityId: user.id });
    return { user: toUserProfile(getUser(ctx, user.id)!), message: "Verified — you're now Tier 2 with the highest limits." };
  });
}

/** Analyst/supervisor decision on a watchlist hit raised during KYC. */
export function resolveScreeningAlert(ctx: AppContext, alertId: string, staff: StaffRow, decision: "CLEAR" | "CONFIRM", note: string) {
  const alert = one<AlertRow>(ctx.db, "SELECT * FROM alerts WHERE id = ?", alertId);
  if (!alert || alert.kind !== "SCREENING") throw notFound("Screening alert not found");
  if (alert.status !== "OPEN") throw conflict("Alert already resolved");
  // Clearing a watchlist hit is the riskier call, so it needs a supervisor.
  if (decision === "CLEAR") requireRole(staff, "SUPERVISOR", "ADMIN");
  if (note.trim().length < 10) throw badRequest("Record the basis for this decision (10+ characters)");

  withTx(ctx.db, () => {
    const now = ctx.nowIso();
    if (decision === "CLEAR") {
      run(
        ctx.db,
        `UPDATE users SET screening_status = 'CLEAR', kyc_review_pending = 0,
           kyc_tier = CASE WHEN kyc_tier = 'TIER_0' THEN 'TIER_1' ELSE kyc_tier END WHERE id = ?`,
        alert.user_id,
      );
      notify(ctx, alert.user_id, "ACCOUNT", "Identity verified. Your limits have been raised to Tier 1.");
    } else {
      run(ctx.db, "UPDATE users SET screening_status = 'CONFIRMED_MATCH', kyc_review_pending = 0, status = 'FROZEN' WHERE id = ?", alert.user_id);
      notify(ctx, alert.user_id, "ACCOUNT", "Your account has been restricted. Please contact support.");
    }
    run(ctx.db, "UPDATE alerts SET status = 'CLOSED', resolution = ?, closed_at = ? WHERE id = ?", `${decision}: ${note}`, now, alertId);
    audit(ctx, {
      actorType: "STAFF",
      actorId: staff.id,
      action: decision === "CLEAR" ? "SCREENING_CLEARED" : "SCREENING_CONFIRMED",
      entityType: "user",
      entityId: alert.user_id,
      details: { alertId, note },
    });
  });
}
