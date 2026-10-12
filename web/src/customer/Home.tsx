import { useEffect, useState } from "react";
import type { CurrencyPocket, Notification, PaymentRequest, UserTransaction } from "@benki/shared";
import { useI18n } from "../i18n";
import { Banner, Meter } from "../ui/common";
import { Icon, type IconName } from "../ui/icons";
import { TxRow } from "../ui/TxRow";
import type { Preset, Section, Session } from "./session";

const HIDE_KEY = "benki.hideBalance";

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === "1";
  } catch {
    return false;
  }
}

const QUICK: { key: Parameters<ReturnType<typeof useI18n>["t"]>[0]; icon: IconName; to: Section; preset?: Preset }[] = [
  { key: "quick.send", icon: "send", to: "send", preset: "benki" },
  { key: "quick.request", icon: "request", to: "requests" },
  { key: "quick.bills", icon: "pay", to: "pay", preset: "bills" },
  { key: "quick.airtime", icon: "zap", to: "pay", preset: "airtime" },
  { key: "quick.cash", icon: "cash", to: "cash" },
  { key: "quick.save", icon: "savings", to: "savings" },
  { key: "quick.borrow", icon: "loans", to: "loans" },
  { key: "quick.convert", icon: "convert", to: "currencies" },
];

export function Home({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { wallet, limits, user, api, go } = session;
  const fmt = (n: number) => money(n, wallet.currency);
  const [hidden, setHidden] = useState(readHidden);
  const [notes, setNotes] = useState<Notification[]>([]);
  const [recent, setRecent] = useState<UserTransaction[]>([]);
  const [pockets, setPockets] = useState<CurrencyPocket[]>([]);
  const [incoming, setIncoming] = useState<PaymentRequest[]>([]);

  useEffect(() => {
    api.notifications().then((r) => setNotes(r.notifications), () => undefined);
    api.transactions(wallet.walletId).then((r) => setRecent(r.transactions.slice(0, 5)), () => undefined);
    api.pockets().then((r) => setPockets(r.pockets), () => undefined);
    api.requests().then((r) => setIncoming(r.requests.filter((q) => q.direction === "INCOMING" && q.status === "PENDING")), () => undefined);
  }, [api, wallet.walletId, wallet.ledgerBalanceMinor]);

  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    try {
      localStorage.setItem(HIDE_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  };
  const mask = (s: string) => (hidden ? "•••••" : s);
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? "home.morning" : hour < 18 ? "home.afternoon" : "home.evening";
  const firstName = user.fullName?.split(/\s+/)[0] ?? "";

  return (
    <div className="stack">
      {user.status === "FROZEN" && <Banner tone="error">{t("home.restricted")}</Banner>}
      {user.kycReviewPending && <Banner tone="warn">{t("home.kycPending")}</Banner>}

      <section className="balance-card">
        <div className="balance-top">
          <span className="greeting">{t(greetingKey, { name: firstName }).replace(/,\s*$/, "")}</span>
          <button className="icon-button on-dark" onClick={toggleHidden} aria-label={hidden ? t("common.showBalance") : t("common.hideBalance")}>
            <Icon name={hidden ? "eye" : "eyeOff"} size={18} />
          </button>
        </div>
        <span className="balance-label">{t("home.available")}</span>
        <div className="balance" data-testid="available-balance">
          {mask(fmt(wallet.availableBalanceMinor))}
        </div>
        <div className="balance-stats">
          <div>
            <span>{t("home.ledger")}</span>
            <strong>{mask(fmt(wallet.ledgerBalanceMinor))}</strong>
          </div>
          <div>
            <span>{t("home.reserved")}</span>
            <strong>{mask(fmt(wallet.reservedBalanceMinor))}</strong>
          </div>
          <div>
            <span>{t("home.inFlight")}</span>
            <strong>{mask(fmt(wallet.pendingBalanceMinor))}</strong>
          </div>
        </div>
        {pockets.length > 0 && (
          <div className="pocket-chips">
            {pockets.map((p) => (
              <button key={p.pocketId} className="pocket-chip" onClick={() => go("currencies")}>
                {mask(money(p.balanceMinor, p.currency))}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="quick-grid" aria-label={t("home.quickActions")}>
        {QUICK.map((q) => (
          <button key={q.key} className="quick" onClick={() => go(q.to, q.preset)}>
            <span className="quick-icon">
              <Icon name={q.icon} />
            </span>
            <span>{t(q.key)}</span>
          </button>
        ))}
      </section>

      {incoming.length > 0 && (
        <button className="alert-card" onClick={() => go("requests")}>
          <Icon name="requests" />
          <span>
            <strong>{t("home.requestsWaiting")}</strong>
            <span className="muted small">
              {incoming
                .slice(0, 2)
                .map((r) => `${r.counterparty} · ${money(r.amountMinor, r.currency)}`)
                .join(" — ")}
            </span>
          </span>
          <Icon name="chevron" />
        </button>
      )}

      {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
        <section className="nudge">
          <Icon name="sparkle" size={22} />
          <div>
            <strong>{t("home.verifyTitle")}</strong>
            <p className="muted small">{t("home.verifyBody")}</p>
          </div>
          <button className="small" onClick={() => go("profile")}>
            {t("home.verifyNow")}
          </button>
        </section>
      )}

      <div className="two-col">
        <section className="card">
          <div className="spread">
            <h3>{t("home.recent")}</h3>
            <button className="link" onClick={() => go("activity")}>
              {t("home.seeAll")}
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="muted">{t("home.noActivity")}</p>
          ) : (
            <ul className="tx-list">
              {recent.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </ul>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="spread">
              <h3>{t("home.limits")}</h3>
              <span className="badge">{t(`tier.${user.kycTier}`)}</span>
            </div>
            {(
              [
                ["home.today", limits.dailyUsedMinor, limits.dailyLimitMinor],
                ["home.last30", limits.monthlyUsedMinor, limits.monthlyLimitMinor],
                ["home.holdings", limits.totalHoldingsMinor, limits.maxBalanceMinor],
              ] as const
            ).map(([key, used, total]) => (
              <div key={key} className="limit">
                <div className="spread small">
                  <span>{t(key)}</span>
                  <span className="muted">{t("home.usedOf", { used: fmt(used), limit: fmt(total) })}</span>
                </div>
                <Meter used={used} total={total} />
              </div>
            ))}
            <span className="muted small">{t("home.perPayment", { amount: fmt(limits.perTransactionMinor) })}</span>
          </section>

          <section className="card">
            <div className="spread">
              <h3>
                <Icon name="bell" size={16} /> {t("home.notifications")}
              </h3>
              {notes.some((n) => !n.read) && (
                <button className="link" onClick={() => api.markNotificationsRead().then(() => setNotes(notes.map((n) => ({ ...n, read: true }))))}>
                  {t("home.markRead")}
                </button>
              )}
            </div>
            {notes.length === 0 ? (
              <p className="muted">{t("common.nothingYet")}</p>
            ) : (
              <ul className="note-list">
                {notes.slice(0, 5).map((n) => (
                  <li key={n.id} className={n.read ? undefined : "unread"}>
                    <span className={`dot ${n.kind.toLowerCase()}`} />
                    <div>
                      <span className="small">{n.message}</span>
                      <span className="muted small">{date(n.createdAt, true)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
