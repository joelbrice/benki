import { useState } from "react";
import { TIER_LIMITS, type Locale } from "@benki/shared";
import { useI18n } from "../i18n";
import { Banner, PageHeader, PinField, useAction } from "../ui/common";
import { Icon } from "../ui/icons";
import { LanguageSelect } from "../ui/LanguageSelect";
import type { Session } from "./session";

export function Profile({ session, onLogout, onLanguage }: { session: Session; onLogout: () => void; onLanguage: (l: Locale) => void }) {
  const { t, money } = useI18n();
  const { api, user, wallet, country } = session;
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [addressOk, setAddressOk] = useState(false);
  const [livenessOk, setLivenessOk] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const kyc = useAction();
  const pin = useAction();
  const fmt = (n: number) => money(n, wallet.currency);

  return (
    <div className="stack">
      <PageHeader title={t("profile.title")} subtitle={`${user.fullName ?? user.phoneNumber} · ${user.phoneNumber}`} />
      {message && <Banner tone="success">{message}</Banner>}
      <div className="two-col">
        <section className="card">
          <div className="spread">
            <h3>
              <Icon name="shield" size={18} /> {t("profile.identity")}
            </h3>
            <span className="badge">{t(`tier.${user.kycTier}`)}</span>
          </div>
          {user.fullName && (
            <dl className="summary">
              <dt>{t("profile.name")}</dt>
              <dd>{user.fullName}</dd>
              <dt>{t("profile.dob")}</dt>
              <dd>{user.dateOfBirth}</dd>
              <dt>{t("profile.nationalId")}</dt>
              <dd>{user.nationalIdMasked}</dd>
            </dl>
          )}
          {user.kycReviewPending && <Banner tone="warn">{t("profile.pending")}</Banner>}

          {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
            <div className="subcard">
              <h3>{t("profile.tier1")}</h3>
              <label htmlFor="kyc-name">
                {t("profile.fullName")}
                <input id="kyc-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </label>
              <label htmlFor="kyc-dob">
                {t("profile.dob")}
                <input id="kyc-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </label>
              <label htmlFor="kyc-id">
                {t("profile.idNumber")}
                <input id="kyc-id" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
              </label>
              <p className="muted small">{t("profile.privacy")}</p>
              {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
              <button
                disabled={kyc.busy || !fullName || !dob || !nationalId}
                onClick={() =>
                  kyc.run(async () => {
                    const res = await api.kycTier1({ fullName, dateOfBirth: dob, nationalId });
                    setMessage(res.user.kycReviewPending ? t("profile.pending") : t("profile.tier1Done"));
                    await session.refresh();
                  })
                }
              >
                {t("profile.verify")}
              </button>
            </div>
          )}

          {user.kycTier === "TIER_1" && (
            <div className="subcard">
              <h3>{t("profile.tier2")}</h3>
              <label className="inline">
                <input type="checkbox" checked={addressOk} onChange={(e) => setAddressOk(e.target.checked)} /> {t("profile.address")}
              </label>
              <label className="inline">
                <input type="checkbox" checked={livenessOk} onChange={(e) => setLivenessOk(e.target.checked)} /> {t("profile.liveness")}
              </label>
              {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
              <button
                disabled={kyc.busy || !addressOk || !livenessOk}
                onClick={() =>
                  kyc.run(async () => {
                    await api.kycTier2();
                    setMessage(t("profile.tier2Done"));
                    await session.refresh();
                  })
                }
              >
                {t("profile.upgrade")}
              </button>
            </div>
          )}

          <h3>{t("profile.limitsTable")}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("profile.colTier")}</th>
                  <th>{t("profile.colPerPayment")}</th>
                  <th>{t("profile.colDaily")}</th>
                  <th>{t("profile.colMonthly")}</th>
                  <th>{t("profile.colHoldings")}</th>
                </tr>
              </thead>
              <tbody>
                {(["TIER_0", "TIER_1", "TIER_2"] as const).map((tier) => {
                  const l = TIER_LIMITS[country.code][tier];
                  return (
                    <tr key={tier} className={tier === user.kycTier ? "current" : undefined}>
                      <td>{t(`tier.${tier}`)}</td>
                      <td>{fmt(l.perTransactionMinor)}</td>
                      <td>{fmt(l.dailyMinor)}</td>
                      <td>{fmt(l.monthlyMinor)}</td>
                      <td>{fmt(l.maxBalanceMinor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <div className="stack">
          <section className="card">
            <h3>
              <Icon name="language" size={18} /> {t("profile.language")}
            </h3>
            <p className="muted small">{t("profile.languageHint")}</p>
            <LanguageSelect countryCode={country.code} onChange={onLanguage} />
          </section>

          <section className="card">
            <h3>
              <Icon name="shield" size={18} /> {t("profile.security")}
            </h3>
            <PinField id="current-pin" label={t("profile.currentPin")} value={currentPin} onChange={setCurrentPin} />
            <PinField id="change-pin" label={t("profile.newPin")} value={newPin} onChange={setNewPin} />
            {pin.error && <Banner tone="error">{pin.error}</Banner>}
            <button
              className="secondary"
              disabled={pin.busy || currentPin.length < 4 || newPin.length < 4}
              onClick={() =>
                pin.run(async () => {
                  await api.changePin(currentPin, newPin);
                  setCurrentPin("");
                  setNewPin("");
                  setMessage(t("profile.pinChanged"));
                })
              }
            >
              {t("profile.changePin")}
            </button>
            <p className="muted small">{t("profile.signedIn", { phone: user.phoneNumber })}</p>
            <button className="ghost" onClick={onLogout}>
              <Icon name="logout" size={16} /> {t("nav.signOut")}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
