import type { AppContext } from "../context";
import { withTx } from "../db/database";
import { run } from "../db/query";
import type { UserRow } from "../db/rows";
import { hashSecret, verifySecret } from "../lib/crypto";
import { badRequest, conflict, pinInvalid, pinLocked } from "../lib/errors";
import { audit } from "./audit";
import { notify } from "./notifications";
import { getUser } from "./users";

const MAX_PIN_ATTEMPTS = 3;
const PIN_LOCK_MS = 30 * 60 * 1000;

/** Rejects PINs that are trivially guessable or derived from the customer's own data. */
export function assertStrongPin(pin: string, user: UserRow) {
  if (!/^\d{4,6}$/.test(pin)) throw badRequest("PIN must be 4 to 6 digits");
  const digits = pin.split("").map(Number);
  const allSame = digits.every((d) => d === digits[0]);
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (allSame || ascending || descending) throw badRequest("Choose a PIN that isn't a repeated or sequential pattern");
  if (user.phone.endsWith(pin)) throw badRequest("Your PIN can't be part of your phone number");
  if (user.date_of_birth) {
    const [year, month, day] = user.date_of_birth.split("-");
    if ([year, `${day}${month}`, `${month}${day}`, `${day}${month}${year.slice(2)}`].includes(pin)) {
      throw badRequest("Your PIN can't be based on your date of birth");
    }
  }
}

export function setPin(ctx: AppContext, user: UserRow, pin: string) {
  if (user.pin_hash) throw conflict("A PIN is already set. Use change PIN instead.");
  assertStrongPin(pin, user);
  withTx(ctx.db, () => {
    run(ctx.db, "UPDATE users SET pin_hash = ?, pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = ?", hashSecret(pin), user.id);
    audit(ctx, { actorType: "USER", actorId: user.id, action: "PIN_SET", entityType: "user", entityId: user.id });
  });
}

export function changePin(ctx: AppContext, user: UserRow, currentPin: string, newPin: string) {
  verifyPin(ctx, user, currentPin);
  assertStrongPin(newPin, user);
  withTx(ctx.db, () => {
    run(ctx.db, "UPDATE users SET pin_hash = ? WHERE id = ?", hashSecret(newPin), user.id);
    notify(ctx, user.id, "SECURITY", "Your transaction PIN was changed. If this wasn't you, contact support immediately.");
    audit(ctx, { actorType: "USER", actorId: user.id, action: "PIN_CHANGED", entityType: "user", entityId: user.id });
  });
}

/**
 * Verifies the transaction PIN. Must run *before* (not inside) the business
 * transaction: a failed attempt has to be persisted even though the request
 * then fails, otherwise lockout could be bypassed by retrying.
 */
export function verifyPin(ctx: AppContext, userRow: UserRow, pin: string | undefined) {
  const user = getUser(ctx, userRow.id)!;
  if (!user.pin_hash) throw badRequest("Set a transaction PIN before moving money");
  if (user.pin_locked_until && new Date(user.pin_locked_until) > ctx.now()) {
    throw pinLocked("Your PIN is locked after too many attempts. Try again later or contact support.");
  }
  if (pin && verifySecret(pin, user.pin_hash)) {
    if (user.pin_failed_attempts > 0) run(ctx.db, "UPDATE users SET pin_failed_attempts = 0, pin_locked_until = NULL WHERE id = ?", user.id);
    return;
  }
  const attempts = user.pin_failed_attempts + 1;
  if (attempts >= MAX_PIN_ATTEMPTS) {
    withTx(ctx.db, () => {
      run(
        ctx.db,
        "UPDATE users SET pin_failed_attempts = 0, pin_locked_until = ? WHERE id = ?",
        new Date(ctx.now().getTime() + PIN_LOCK_MS).toISOString(),
        user.id,
      );
      notify(ctx, user.id, "SECURITY", "Your PIN was locked for 30 minutes after 3 incorrect attempts. If this wasn't you, contact support.");
      audit(ctx, { actorType: "USER", actorId: user.id, action: "PIN_LOCKED", entityType: "user", entityId: user.id });
    });
    throw pinLocked("Too many incorrect PIN attempts. Your PIN is locked for 30 minutes.");
  }
  run(ctx.db, "UPDATE users SET pin_failed_attempts = ? WHERE id = ?", attempts, user.id);
  throw pinInvalid(`Incorrect PIN. ${MAX_PIN_ATTEMPTS - attempts} attempt(s) left.`);
}
