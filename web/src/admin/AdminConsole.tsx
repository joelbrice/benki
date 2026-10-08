import { useEffect, useMemo, useState } from "react";
import { adminApi, ApiRequestError, staffLogin } from "../api";
import { Banner, useAction } from "../ui/common";
import { Approvals, Audit, Cases, Customers, Disputes, Ledger, Overview, Reconciliation, ReviewQueue, type StaffInfo } from "./sections";

const TOKEN_KEY = "benki.staffToken";
const SECTIONS = ["Overview", "Review queue", "Cases", "Customers", "Approvals", "Disputes", "Ledger", "Reconciliation", "Audit"] as const;
type SectionName = (typeof SECTIONS)[number];

function StaffLogin({ onLogin }: { onLogin: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, run } = useAction();
  return (
    <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
      <h2>Back-office sign in</h2>
      <p className="muted small">Compliance and operations staff only. Every action is recorded in a tamper-evident audit log.</p>
      <label htmlFor="staff-user">
        Username
        <input id="staff-user" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </label>
      <label htmlFor="staff-pass">
        Password
        <input id="staff-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <Banner tone="error">{error}</Banner>}
      <button disabled={busy || !username || !password} onClick={() => run(async () => onLogin((await staffLogin(username, password)).token))}>
        Sign in
      </button>
      <a className="small" href="#/">
        ← Customer app
      </a>
    </div>
  );
}

export function AdminConsole() {
  const [token, setToken] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const api = useMemo(() => (token ? adminApi(token) : null), [token]);
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [section, setSection] = useState<SectionName>("Overview");

  const signOut = () => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
    setToken(null);
    setStaff(null);
  };

  useEffect(() => {
    if (!api) return;
    api.me().then(setStaff, (e) => {
      if (e instanceof ApiRequestError && e.status === 401) signOut();
    });
  }, [api]);

  if (!token || !api) {
    return (
      <div className="shell wide">
        <StaffLogin
          onLogin={(t) => {
            try {
              sessionStorage.setItem(TOKEN_KEY, t);
            } catch {
              /* stay signed in for this page only */
            }
            setToken(t);
          }}
        />
      </div>
    );
  }
  if (!staff) return <div className="shell wide muted">Loading…</div>;

  return (
    <div className="shell wide">
      <header className="topbar">
        <div className="brand">
          <strong>Benki back office</strong>
          <span>Compliance & operations</span>
        </div>
        <div className="row">
          <span className="badge neutral">
            {staff.username} · {staff.role}
          </span>
          <button className="small ghost" onClick={() => api.logout().finally(signOut)}>
            Sign out
          </button>
        </div>
      </header>
      <div className="admin-layout">
        <nav className="admin-nav" aria-label="Back-office sections">
          {SECTIONS.map((s) => (
            <button key={s} className={s === section ? "active" : undefined} aria-current={s === section} onClick={() => setSection(s)}>
              {s}
            </button>
          ))}
        </nav>
        <main style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {section === "Overview" && <Overview api={api} />}
          {section === "Review queue" && <ReviewQueue api={api} staff={staff} />}
          {section === "Cases" && <Cases api={api} staff={staff} />}
          {section === "Customers" && <Customers api={api} />}
          {section === "Approvals" && <Approvals api={api} staff={staff} />}
          {section === "Disputes" && <Disputes api={api} />}
          {section === "Ledger" && <Ledger api={api} />}
          {section === "Reconciliation" && <Reconciliation api={api} />}
          {section === "Audit" && <Audit api={api} />}
        </main>
      </div>
    </div>
  );
}
