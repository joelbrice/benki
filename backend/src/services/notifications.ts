import { renderMsg, type Locale, type Msg, type Notification } from "@benki/shared";
import type { AppContext } from "../context";
import { all, one, run } from "../db/query";
import { newId } from "../lib/ids";

/**
 * In-app notification inbox. In production each of these would also go out
 * over SMS — the channel that reaches feature-phone users in low-connectivity
 * areas (docs/PRD.md section 6).
 */
export function notify(ctx: AppContext, userId: string, kind: Notification["kind"], message: string | Msg) {
  // Rendered once, in the recipient's language, because it is also what goes out by SMS.
  const locale = one<{ locale: Locale }>(ctx.db, "SELECT locale FROM users WHERE id = ?", userId)?.locale ?? "en";
  run(
    ctx.db,
    "INSERT INTO notifications (id, user_id, kind, message, created_at, read) VALUES (?, ?, ?, ?, ?, 0)",
    newId("NTF"),
    userId,
    kind,
    renderMsg(locale, message),
    ctx.nowIso(),
  );
}

export function listNotifications(ctx: AppContext, userId: string): Notification[] {
  return all<{ id: string; kind: Notification["kind"]; message: string; created_at: string; read: number }>(
    ctx.db,
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 50",
    userId,
  ).map((n) => ({ id: n.id, kind: n.kind, message: n.message, createdAt: n.created_at, read: !!n.read }));
}

export function markNotificationsRead(ctx: AppContext, userId: string) {
  run(ctx.db, "UPDATE notifications SET read = 1 WHERE user_id = ?", userId);
}
