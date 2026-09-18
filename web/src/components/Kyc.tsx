import type { KycTier } from "@benki/shared";
import { KYC_TIER_TRANSFER_LIMITS_MINOR } from "@benki/shared";

interface Props {
  kycTier: KycTier;
  busy: boolean;
  onUpgrade: (tier: "TIER_1" | "TIER_2") => Promise<void>;
  onContinue: () => void;
}

export function Kyc({ kycTier, busy, onUpgrade, onContinue }: Props) {
  return (
    <div className="card">
      <h2>Identity verification</h2>
      <span className="tier-badge">{kycTier.replace("_", " ")}</span>
      <p>
        Transfer limit at this tier: {KYC_TIER_TRANSFER_LIMITS_MINOR[kycTier].toLocaleString()} minor
        units per transaction.
      </p>
      {kycTier === "TIER_0" && (
        <button disabled={busy} onClick={() => onUpgrade("TIER_1")}>
          Upgrade to Tier 1 (basic ID)
        </button>
      )}
      {kycTier === "TIER_1" && (
        <button disabled={busy} onClick={() => onUpgrade("TIER_2")}>
          Upgrade to Tier 2 (full KYC)
        </button>
      )}
      <button className="secondary" disabled={busy} onClick={onContinue}>
        Continue to wallet
      </button>
    </div>
  );
}
