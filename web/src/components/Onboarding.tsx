import { useState } from "react";

interface Props {
  onRequestOtp: (phoneNumber: string, country: string) => Promise<void>;
  onVerify: (otp: string) => Promise<void>;
  otpSent: boolean;
  busy: boolean;
}

export function Onboarding({ onRequestOtp, onVerify, otpSent, busy }: Props) {
  const [phoneNumber, setPhoneNumber] = useState("+221700000001");
  const [country, setCountry] = useState("Senegal");
  const [otp, setOtp] = useState("");

  return (
    <div className="card">
      <h2>Sign in</h2>
      {!otpSent ? (
        <>
          <div>
            <label htmlFor="phone">Phone number</label>
            <input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
          </div>
          <div>
            <label htmlFor="country">Country</label>
            <input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <button
            disabled={busy || !phoneNumber.trim() || !country.trim()}
            onClick={() => onRequestOtp(phoneNumber, country)}
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
