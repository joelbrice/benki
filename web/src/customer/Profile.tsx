import { useState } from "react";
import { formatAmount, TIER_LIMITS } from "@benki/shared";
import { Banner, useAction } from "../ui/common";
import type { Session } from "./session";

export function Profile({ session, onLogout }: { session: Session; onLogout: () => void }) {
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
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  const fmt = (n: number) => formatAmount(n, wallet.currency);

  return (
    <>
      <div className="card">
        <div className="spread">
          <h2>Identity verification</h2>
          <span className="badge">{user.kycTier.replace("_", " ")}</span>
        </div>
        {message && <Banner tone="success">{message}</Banner>}
        {user.fullName && (
          <dl className="summary">
            <dt>Name</dt>
            <dd>{user.fullName}</dd>
            <dt>Date of birth</dt>
            <dd>{user.dateOfBirth}</dd>
            <dt>National ID</dt>
            <dd>{user.nationalIdMasked}</dd>
          </dl>
        )}
        {user.kycReviewPending && <Banner tone="warn">Your details are being verified. We'll notify you when it's done.</Banner>}

        {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
          <div className="subcard">
            <h3>Tier 1 — national ID</h3>
            <label htmlFor="kyc-name">
              Full legal name
              <input id="kyc-name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label htmlFor="kyc-dob">
              Date of birth
              <input id="kyc-dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </label>
            <label htmlFor="kyc-id">
              National ID number
              <input id="kyc-id" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
            </label>
            <p className="muted small">Your ID number is encrypted and only shown masked. We check it against official watchlists, as the law requires.</p>
            {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
            <button
              disabled={kyc.busy || !fullName || !dob || !nationalId}
              onClick={() =>
                kyc.run(async () => {
                  const res = await api.kycTier1({ fullName, dateOfBirth: dob, nationalId });
                  setMessage(res.message);
                  await session.refresh();
                })
              }
            >
              Verify
            </button>
          </div>
        )}

        {user.kycTier === "TIER_1" && (
          <div className="subcard">
            <h3>Tier 2 — enhanced verification</h3>
            <label className="inline">
              <input type="checkbox" checked={addressOk} onChange={(e) => setAddressOk(e.target.checked)} /> I uploaded a proof of address (utility bill or
              chief's letter)
            </label>
            <label className="inline">
              <input type="checkbox" checked={livenessOk} onChange={(e) => setLivenessOk(e.target.checked)} /> I completed the selfie liveness check
            </label>
            {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
            <button
              disabled={kyc.busy || !addressOk || !livenessOk}
              onClick={() =>
                kyc.run(async () => {
                  const res = await api.kycTier2();
                  setMessage(res.message);
                  await session.refresh();
                })
              }
            >
              Upgrade to Tier 2
            </button>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Per payment</th>
                <th>Daily</th>
                <th>30 days</th>
                <th>Max holdings</th>
              </tr>
            </thead>
            <tbody>
              {(["TIER_0", "TIER_1", "TIER_2"] as const).map((t) => {
                const l = TIER_LIMITS[country.code][t];
                return (
                  <tr key={t} style={{ fontWeight: t === user.kycTier ? 700 : 400 }}>
                    <td>{t.replace("_", " ")}</td>
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
      </div>

      <div className="card">
        <h2>Security</h2>
        <label htmlFor="current-pin">
          Current PIN
          <input id="current-pin" type="password" inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(digits(e.target.value))} />
        </label>
        <label htmlFor="change-pin">
          New PIN
          <input id="change-pin" type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(digits(e.target.value))} />
        </label>
        {pin.error && <Banner tone="error">{pin.error}</Banner>}
        <button
          className="secondary"
          disabled={pin.busy || currentPin.length < 4 || newPin.length < 4}
          onClick={() =>
            pin.run(async () => {
              await api.changePin(currentPin, newPin);
              setCurrentPin("");
              setNewPin("");
              setMessage("PIN changed.");
            })
          }
        >
          Change PIN
        </button>
        <p className="muted small">
          Signed in as {user.phoneNumber} on this device. Three wrong PINs lock payments for 30 minutes.
        </p>
        <button className="ghost" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </>
  );
}
