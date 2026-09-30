import { useState } from "react";
import { AFRICAN_COUNTRIES, DEFAULT_COUNTRY_CODE } from "@benki/shared";

interface Props {
  onRequestOtp: (phoneNumber: string, countryCode: string) => Promise<void>;
  onVerify: (otp: string) => Promise<void>;
  otpSent: boolean;
  busy: boolean;
}

export function Onboarding({ onRequestOtp, onVerify, otpSent, busy }: Props) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState("+221700000001");
  const [otp, setOtp] = useState("");

  return (
    <div className="card">
      <h2>Sign in</h2>
      {!otpSent ? (
        <>
          <div>
            <label htmlFor="country">Country</label>
            <select id="country" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {AFRICAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.currency}, {c.callingCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="phone">Phone number</label>
            <input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <button
            disabled={busy || !phoneNumber.trim()}
            onClick={() => onRequestOtp(phoneNumber, countryCode)}
          >
            Send OTP
          </button>
        </>
      ) : (
        <>
          <p>An OTP was sent to {phoneNumber}. Enter it below.</p>
          <div>
            <label htmlFor="otp">One-time code</label>
            <input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} />
          </div>
          <button disabled={busy || !otp.trim()} onClick={() => onVerify(otp)}>
            Verify &amp; continue
          </button>
        </>
      )}
    </div>
  );
}
