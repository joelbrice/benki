import { useEffect, useState } from "react";
import { formatAmount, type Notification } from "@benki/shared";
import { Banner, Meter } from "../ui/common";
import type { Session } from "./session";

export function Home({ session, onVerify }: { session: Session; onVerify: () => void }) {
  const { wallet, limits, user, api } = session;
  const fmt = (n: number) => formatAmount(n, wallet.currency);
  const [notes, setNotes] = useState<Notification[]>([]);

  useEffect(() => {
    api.notifications().then((r) => setNotes(r.notifications), () => undefined);
  }, [api, wallet.ledgerBalanceMinor]);

  return (
    <>
      {user.status === "FROZEN" && <Banner tone="error">Your account is restricted. Please contact support.</Banner>}
      {user.kycReviewPending && <Banner tone="warn">We're verifying your identity details. We'll notify you when it's done.</Banner>}
      {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
        <Banner>
          You're on basic limits.{" "}
          <button className="small secondary" onClick={onVerify}>
            Verify your identity
          </button>{" "}
          to send more, save and send abroad.
        </Banner>
      )}

      <div className="card">
        <span className="muted">Available balance</span>
        <div className="balance" data-testid="available-balance">
          {fmt(wallet.availableBalanceMinor)}
        </div>
        <div className="grid">
          <div className="stat">
            <span className="muted small">Ledger balance</span>
            <strong>{fmt(wallet.ledgerBalanceMinor)}</strong>
          </div>
          <div className="stat">
            <span className="muted small">Reserved (processing)</span>
            <strong>{fmt(wallet.reservedBalanceMinor)}</strong>
          </div>
          <div className="stat">
            <span className="muted small">Sending to other wallets</span>
            <strong>{fmt(wallet.pendingBalanceMinor)}</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <h3>Your limits</h3>
          <span className="badge">{user.kycTier.replace("_", " ")}</span>
        </div>
        <div className="subcard">
          <div className="spread small">
            <span>Today</span>
            <span>
              {fmt(limits.dailyUsedMinor)} of {fmt(limits.dailyLimitMinor)}
            </span>
          </div>
          <Meter used={limits.dailyUsedMinor} total={limits.dailyLimitMinor} />
          <div className="spread small">
            <span>Last 30 days</span>
            <span>
              {fmt(limits.monthlyUsedMinor)} of {fmt(limits.monthlyLimitMinor)}
            </span>
          </div>
          <Meter used={limits.monthlyUsedMinor} total={limits.monthlyLimitMinor} />
          <div className="spread small">
            <span>Total holdings (wallet + savings)</span>
            <span>
              {fmt(limits.totalHoldingsMinor)} of {fmt(limits.maxBalanceMinor)}
            </span>
          </div>
          <Meter used={limits.totalHoldingsMinor} total={limits.maxBalanceMinor} />
          <span className="muted small">Single payment limit: {fmt(limits.perTransactionMinor)}</span>
        </div>
      </div>

      <div className="card">
        <div className="spread">
          <h3>Notifications</h3>
          {notes.some((n) => !n.read) && (
            <button className="small ghost" onClick={() => api.markNotificationsRead().then(() => setNotes(notes.map((n) => ({ ...n, read: true }))))}>
              Mark all read
            </button>
          )}
        </div>
        {notes.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="list">
            {notes.slice(0, 6).map((n) => (
              <li key={n.id} style={{ fontWeight: n.read ? 400 : 600 }}>
                <div className="spread">
                  <span className={`badge ${n.kind === "SECURITY" ? "danger" : n.kind === "ACCOUNT" ? "warn" : "neutral"}`}>{n.kind}</span>
                  <span className="muted small">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <span className="small">{n.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
