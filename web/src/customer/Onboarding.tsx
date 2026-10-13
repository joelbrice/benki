import { useState } from "react";
import { COUNTRY_BY_CODE, DEFAULT_COUNTRY_CODE, DEFAULT_LOCALE_BY_COUNTRY, LIVE_COUNTRIES, PLANNED_COUNTRIES, USSD_SHORT_CODE, type MessageKey } from "@benki/shared";
import { CountryOptions } from "../ui/CountryOptions";
import { authApi } from "../api";
import { useI18n } from "../i18n";
import { Banner, useAction } from "../ui/common";
import { Icon } from "../ui/icons";
import { LanguageSelect } from "../ui/LanguageSelect";

export function Onboarding({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const { t, setLocale, locale } = useI18n();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState(COUNTRY_BY_CODE[DEFAULT_COUNTRY_CODE].callingCode);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [languageTouched, setLanguageTouched] = useState(false);
  const { busy, error, run } = useAction();

  const changeCountry = (code: string) => {
    setCountryCode(code);
    setPhone(COUNTRY_BY_CODE[code].callingCode);
    // Follow the market's main language until the person picks one themselves.
    if (!languageTouched && locale !== DEFAULT_LOCALE_BY_COUNTRY[code]) setLocale(DEFAULT_LOCALE_BY_COUNTRY[code] ?? "en");
  };

  return (
    <div className="onboarding">
      <section className="hero">
        <div className="hero-brand">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <strong>Benki</strong>
        </div>
        <h1>{t("onboarding.heroTitle")}</h1>
        <p>{t("onboarding.heroBody")}</p>
        <ul className="hero-points">
          {(["onboarding.point1", "onboarding.point2", "onboarding.point3"] as const).map((k, i) => (
            <li key={k}>
              <Icon name={(["send", "currencies", "shield"] as const)[i]} size={18} />
              {t(k, { count: LIVE_COUNTRIES.length })}
            </li>
          ))}
        </ul>
        <div className="hero-flags" aria-hidden="true">
          {LIVE_COUNTRIES.map((c) => (
            <span key={c.code}>{c.flag}</span>
          ))}
        </div>
        <p className="hero-soon">{t("onboarding.comingSoonLine", { count: PLANNED_COUNTRIES.length })}</p>
      </section>

      <section className="auth-card">
        <div className="auth-top">
          <h2>{otpSent ? t("onboarding.enterCode") : t("onboarding.title")}</h2>
          <LanguageSelect compact countryCode={countryCode} onChange={() => setLanguageTouched(true)} />
        </div>
        {!otpSent ? (
          <>
            <label htmlFor="country">
              {t("onboarding.country")}
              <select id="country" value={countryCode} onChange={(e) => changeCountry(e.target.value)}>
                <CountryOptions countries={LIVE_COUNTRIES} detail />
                <optgroup label={t("onboarding.comingSoon")}>
                  {PLANNED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code} disabled>
                      {c.flag} {t(`country.${c.code}` as MessageKey)}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <label htmlFor="phone">
              {t("onboarding.phone")}
              <input id="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} />
            </label>
            <button
              className="block"
              disabled={busy || phone.length < 9}
              onClick={() =>
                run(async () => {
                  const res = await authApi.sendOtp(phone, countryCode);
                  setDevOtp(res.devOtp ?? null);
                  setOtpSent(true);
                })
              }
            >
              {t("onboarding.sendCode")}
            </button>
          </>
        ) : (
          <>
            <p className="muted">{t("onboarding.codeSent", { phone })}</p>
            {devOtp && <Banner tone="warn">{t("onboarding.sandboxCode", { code: devOtp })}</Banner>}
            <label htmlFor="otp">
              {t("onboarding.code")}
              <input
                id="otp"
                className="otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button className="block" disabled={busy || otp.length !== 6} onClick={() => run(async () => onSignedIn((await authApi.verifyOtp(phone, otp, locale)).token))}>
              {t("onboarding.verify")}
            </button>
            <button className="ghost block" disabled={busy} onClick={() => setOtpSent(false)}>
              {t("onboarding.changeNumber")}
            </button>
          </>
        )}
        {error && <Banner tone="error">{error}</Banner>}
        <p className="muted small">
          <Icon name="shield" size={14} /> {t("onboarding.safety")}
        </p>
        <div className="auth-links small">
          <span>
            <Icon name="phone" size={14} /> {t("onboarding.ussd", { code: USSD_SHORT_CODE })} · <a href="#/ussd">{t("onboarding.ussdDemo")}</a>
          </span>
          <a href="#/admin">{t("onboarding.staff")}</a>
        </div>
      </section>
    </div>
  );
}
