import { useCallback, useEffect, useMemo, useState } from "react";
import { COUNTRY_BY_CODE } from "@benki/shared";
import { ApiRequestError, customerApi } from "../api";
import { Banner } from "../ui/common";
import { Cash } from "./Cash";
import { History } from "./History";
import { Home } from "./Home";
import { Onboarding } from "./Onboarding";
import { Pay } from "./Pay";
import { Profile } from "./Profile";
import { Savings } from "./Savings";
import type { Session } from "./session";
import { Send } from "./Send";
import { SetPin } from "./SetPin";

const TABS = ["Home", "Send", "Pay", "Cash", "Savings", "History", "Profile"] as const;
type Tab = (typeof TABS)[number];
const TOKEN_KEY = "benki.token";

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function CustomerApp() {
  const [token, setToken] = useState<string | null>(readToken);
  const api = useMemo(() => (token ? customerApi(token) : null), [token]);
  const [session, setSession] = useState<Omit<Session, "refresh"> | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [tab, setTab] = useState<Tab>("Home");
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
    setToken(null);
    setSession(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      let { user, wallet } = await api.me();
      if (!wallet && user.status === "ACTIVE") wallet = (await api.createWallet()).wallet;
      setNeedsPin(!user.pinSet);
      if (!wallet) throw new Error("Wallet unavailable");
      const limits = await api.limits();
      setSession({ api, user, wallet, limits, country: COUNTRY_BY_CODE[user.countryCode] });
      setError(null);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) signOut();
      else setError(e instanceof Error ? e.message : "Couldn't load your account");
    }
  }, [api, signOut]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const header = (
    <header className="topbar">
      <div className="brand">
        <strong>Benki</strong>
        <span>Bank without borders</span>
      </div>
      {session && (
        <span className="muted small">
          {session.user.fullName ?? session.user.phoneNumber} · {session.country.name}
        </span>
      )}
    </header>
  );

  if (!token || !api) {
    return (
      <div className="shell">
        {header}
        <Onboarding
          onSignedIn={(t) => {
            try {
              sessionStorage.setItem(TOKEN_KEY, t);
            } catch {
              /* storage unavailable: stay signed in for this page only */
            }
            setToken(t);
          }}
        />
        <p className="muted small" style={{ textAlign: "center" }}>
          Staff? <a href="#/admin">Open the back-office console</a>
        </p>
      </div>
    );
  }

  if (needsPin) {
    return (
      <div className="shell">
        {header}
        <SetPin api={api} onDone={() => void refresh()} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="shell">
        {header}
        {error ? <Banner tone="error">{error}</Banner> : <p className="muted">Loading your account…</p>}
      </div>
    );
  }

  const full: Session = { ...session, refresh };
  return (
    <div className="shell">
      {header}
      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "active" : undefined} aria-current={t === tab} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      {error && <Banner tone="error">{error}</Banner>}
      {tab === "Home" && <Home session={full} onVerify={() => setTab("Profile")} />}
      {tab === "Send" && <Send session={full} />}
      {tab === "Pay" && <Pay session={full} />}
      {tab === "Cash" && <Cash session={full} />}
      {tab === "Savings" && <Savings session={full} />}
      {tab === "History" && <History session={full} />}
      {tab === "Profile" && (
        <Profile
          session={full}
          onLogout={() => {
            void api.logout().finally(signOut);
          }}
        />
      )}
    </div>
  );
}
