import { useCallback, useEffect, useMemo, useState } from "react";
import { COUNTRY_BY_CODE, type Locale, type MessageKey } from "@benki/shared";
import { ApiRequestError, customerApi } from "../api";
import { useI18n } from "../i18n";
import { Banner } from "../ui/common";
import { Icon, type IconName } from "../ui/icons";
import { LanguageSelect } from "../ui/LanguageSelect";
import { Activity } from "./Activity";
import { Cash } from "./Cash";
import { Currencies } from "./Currencies";
import { Groups } from "./Groups";
import { Home } from "./Home";
import { Loans } from "./Loans";
import { Onboarding } from "./Onboarding";
import { Pay } from "./Pay";
import { Profile } from "./Profile";
import { Requests } from "./Requests";
import { Savings } from "./Savings";
import { Send } from "./Send";
import type { Preset, Section, Session } from "./session";
import { SetPin } from "./SetPin";

const TOKEN_KEY = "benki.token";

const NAV: { id: Section; icon: IconName }[] = [
  { id: "home", icon: "home" },
  { id: "send", icon: "send" },
  { id: "requests", icon: "requests" },
  { id: "pay", icon: "pay" },
  { id: "cash", icon: "cash" },
  { id: "savings", icon: "savings" },
  { id: "groups", icon: "groups" },
  { id: "loans", icon: "loans" },
  { id: "currencies", icon: "currencies" },
  { id: "activity", icon: "activity" },
  { id: "profile", icon: "profile" },
];
/** Phone layout: four primary destinations plus "More". */
const BOTTOM: Section[] = ["home", "send", "pay", "activity"];

function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function Brand() {
  const { t } = useI18n();
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        B
      </span>
      <div>
        <strong>Benki</strong>
        <span>{t("app.tagline")}</span>
      </div>
    </div>
  );
}

export function CustomerApp() {
  const { t, setLocale, bidi } = useI18n();
  const [token, setToken] = useState<string | null>(readToken);
  const api = useMemo(() => (token ? customerApi(token) : null), [token]);
  const [session, setSession] = useState<Omit<Session, "refresh" | "go" | "preset"> | null>(null);
  const [needsPin, setNeedsPin] = useState(false);
  const [section, setSection] = useState<Section>("home");
  const [preset, setPreset] = useState<Preset | undefined>();
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedLocale, setSyncedLocale] = useState(false);

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* storage unavailable */
    }
    setToken(null);
    setSession(null);
    setSyncedLocale(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    try {
      let { user, wallet } = await api.me();
      if (!wallet && user.status === "ACTIVE") wallet = (await api.createWallet()).wallet;
      setNeedsPin(!user.pinSet);
      if (!wallet) throw new Error("wallet");
      const limits = await api.limits();
      setSession({ api, user, wallet, limits, country: COUNTRY_BY_CODE[user.countryCode] });
      setError(null);
      return user;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) signOut();
      else setError(e instanceof ApiRequestError && e.code === "NETWORK_ERROR" ? t("common.offline") : t("err.generic"));
    }
  }, [api, signOut, t]);

  useEffect(() => {
    void refresh().then((user) => {
      // The account's saved language wins once, at sign-in; after that the switcher drives it.
      if (user && !syncedLocale) {
        setLocale(user.locale);
        setSyncedLocale(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const go = useCallback((next: Section, nextPreset?: Preset) => {
    setSection(next);
    setPreset(nextPreset);
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  const changeLanguage = (locale: Locale) => {
    if (api) void api.setLocale(locale).catch(() => undefined);
  };

  if (!token || !api) {
    return (
      <div className="auth-shell">
        <Onboarding
          onSignedIn={(tok) => {
            try {
              sessionStorage.setItem(TOKEN_KEY, tok);
            } catch {
              /* storage unavailable: stay signed in for this page only */
            }
            setToken(tok);
          }}
        />
      </div>
    );
  }

  if (needsPin) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-top">
            <Brand />
            <LanguageSelect compact onChange={changeLanguage} />
          </div>
          <SetPin api={api} onDone={() => void refresh()} />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <Brand />
          {error ? <Banner tone="error">{error}</Banner> : <p className="muted">{t("common.loading")}</p>}
        </div>
      </div>
    );
  }

  const full: Session = { ...session, refresh: async () => void (await refresh()), go, preset };
  const nameOrPhone = session.user.fullName ?? session.user.phoneNumber;
  const initials = (session.user.fullName ?? "B")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app">
      <aside className="sidebar">
        <Brand />
        <nav aria-label={t("nav.more")}>
          {NAV.map((n) => (
            <button key={n.id} className={`nav-item${section === n.id ? " active" : ""}`} aria-current={section === n.id ? "page" : undefined} onClick={() => go(n.id)}>
              <Icon name={n.icon} />
              {t(`nav.${n.id}`)}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <LanguageSelect countryCode={session.country.code} onChange={changeLanguage} />
          <button className="nav-item" onClick={() => void api.logout().finally(signOut)}>
            <Icon name="logout" />
            {t("nav.signOut")}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="appbar">
          <Brand />
          <div className="row">
            <LanguageSelect compact countryCode={session.country.code} onChange={changeLanguage} />
            <button className="avatar" onClick={() => go("profile")} aria-label={t("nav.profile")}>
              {initials}
            </button>
          </div>
        </header>
        <div className="desktop-user muted small">
          {bidi(nameOrPhone)} · {t(`country.${session.country.code}` as MessageKey)} · {t(`tier.${session.user.kycTier}`)}
        </div>
        {error && <Banner tone="error">{error}</Banner>}
        <main className="content">
          {section === "home" && <Home session={full} />}
          {section === "send" && <Send session={full} />}
          {section === "requests" && <Requests session={full} />}
          {section === "pay" && <Pay session={full} />}
          {section === "cash" && <Cash session={full} />}
          {section === "savings" && <Savings session={full} />}
          {section === "groups" && <Groups session={full} />}
          {section === "loans" && <Loans session={full} />}
          {section === "currencies" && <Currencies session={full} />}
          {section === "activity" && <Activity session={full} />}
          {section === "profile" && <Profile session={full} onLogout={() => void api.logout().finally(signOut)} onLanguage={changeLanguage} />}
        </main>
      </div>

      <nav className="bottom-nav" aria-label={t("nav.more")}>
        {BOTTOM.map((id) => (
          <button key={id} className={section === id ? "active" : undefined} aria-current={section === id ? "page" : undefined} onClick={() => go(id)}>
            <Icon name={NAV.find((n) => n.id === id)!.icon} />
            <span>{t(`nav.${id}`)}</span>
          </button>
        ))}
        <button className={!BOTTOM.includes(section) ? "active" : undefined} onClick={() => setMoreOpen(true)}>
          <Icon name="more" />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={t("nav.more")} onClick={(e) => e.stopPropagation()}>
            <div className="sheet-grid">
              {NAV.filter((n) => !BOTTOM.includes(n.id)).map((n) => (
                <button key={n.id} className="tile" onClick={() => go(n.id)}>
                  <span className="tile-icon">
                    <Icon name={n.icon} />
                  </span>
                  {t(`nav.${n.id}`)}
                </button>
              ))}
              <button className="tile" onClick={() => void api.logout().finally(signOut)}>
                <span className="tile-icon">
                  <Icon name="logout" />
                </span>
                {t("nav.signOut")}
              </button>
            </div>
            <button className="ghost block" onClick={() => setMoreOpen(false)}>
              {t("common.close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
