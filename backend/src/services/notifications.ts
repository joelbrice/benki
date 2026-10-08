import type { Notification } from "@benki/shared";
import type { AppContext } from "../context";
import { all, run } from "../db/query";
import { newId } from "../lib/ids";

/**
 * In-app notification inbox. In production each of these would also go out
 * over SMS — the channel that reaches feature-phone users in low-connectivity
 * areas (docs/PRD.md section 6).
 */
export function notify(ctx: AppContext, userId: string, kind: Notification["kind"], message: string) {
  run(
    ctx.db,
    "INSERT INTO notifications (id, user_id, kind, message, created_at, read) VALUES (?, ?, ?, ?, ?, 0)",
    newId("NTF"),
    userId,
    kind,
    message,
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
