import { useState } from "react";
import { COUNTRY_BY_CODE, formatAmount, transferLimitMinor, type UserProfile } from "@benki/shared";

interface Props {
  user: UserProfile;
  busy: boolean;
  onUpgradeTier1: (nationalId: string) => Promise<void>;
  onUpgradeTier2: () => Promise<void>;
  onContinue: () => void;
}

export function Kyc({ user, busy, onUpgradeTier1, onUpgradeTier2, onContinue }: Props) {
  const [nationalId, setNationalId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const currency = COUNTRY_BY_CODE[user.countryCode]?.currency ?? "XOF";

  return (
    <div className="card">
      <h2>Identity verification</h2>
      <span className="tier-badge">{user.kycTier.replace(/_/g, " ")}</span>
      <p>
        Transfer limit at this tier: {formatAmount(transferLimitMinor(user.countryCode, user.kycTier), currency)}{" "}
        per transaction.
      </p>

      {user.kycTier === "TIER_0" && (
        <div className="sub-card">
          <p>Tier 1 requires a national ID number (docs/KYC_AML_POLICY_AND_RISK.md).</p>
          <div>
            <label htmlFor="nationalId">National ID number</label>
            <input id="nationalId" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          </div>
          <button disabled={busy || !nationalId.trim()} onClick={() => onUpgradeTier1(nationalId)}>
            Upgrade to Tier 1
          </button>
        </div>
      )}

      {user.kycTier === "TIER_1" && (
        <div className="sub-card">
          <p>Tier 2 requires a selfie/liveness check and proof of address.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 400 }}>
            <input
              type="checkbox"
              style={{ width: "auto" }}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm my selfie and proof of address were captured
          </label>
          <button disabled={busy || !confirmed} onClick={onUpgradeTier2}>
            Upgrade to Tier 2
          </button>
        </div>
      )}

      <button className="secondary" disabled={busy} onClick={onContinue}>
        Continue to wallet
      </button>
    </div>
  );
}
