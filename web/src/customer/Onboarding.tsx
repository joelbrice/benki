import { useState } from "react";
import { AFRICAN_COUNTRIES, COUNTRY_BY_CODE, DEFAULT_COUNTRY_CODE } from "@benki/shared";
import { authApi } from "../api";
import { Banner, useAction } from "../ui/common";

export function Onboarding({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState(COUNTRY_BY_CODE[DEFAULT_COUNTRY_CODE].callingCode);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const { busy, error, run } = useAction();

  const changeCountry = (code: string) => {
    setCountryCode(code);
    setPhone(COUNTRY_BY_CODE[code].callingCode);
  };

  return (
    <div className="card">
      <h2>{otpSent ? "Enter your code" : "Sign in or create an account"}</h2>
      {!otpSent ? (
        <>
          <label htmlFor="country">
            Country
            <select id="country" value={countryCode} onChange={(e) => changeCountry(e.target.value)}>
              {AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} · {c.currency} · {c.callingCode}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="phone">
            Mobile number
            <input id="phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} />
          </label>
          <button
            disabled={busy || phone.length < 9}
            onClick={() =>
              run(async () => {
                const res = await authApi.sendOtp(phone, countryCode);
                setDevOtp(res.devOtp ?? null);
                setOtpSent(true);
              })
            }
          >
            Send code by SMS
          </button>
        </>
      ) : (
        <>
          <p className="muted">We sent a 6-digit code to {phone}. It expires in 5 minutes.</p>
          {devOtp && <Banner tone="warn">Sandbox: no SMS gateway is connected, so your code is {devOtp}.</Banner>}
          <label htmlFor="otp">
            One-time code
            <input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
          </label>
          <div className="row">
            <button disabled={busy || otp.length !== 6} onClick={() => run(async () => onSignedIn((await authApi.verifyOtp(phone, otp)).token))}>
              Verify
            </button>
            <button className="ghost" disabled={busy} onClick={() => setOtpSent(false)}>
              Change number
            </button>
          </div>
        </>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <p className="muted small">Your session is tied to this device. Never share your code or PIN — Benki staff will never ask for them.</p>
    </div>
  );
}
