import { Text } from "react-native";
import { KYC_TIER_TRANSFER_LIMITS_MINOR, type KycTier } from "../types";
import { Card, PrimaryButton, SecondaryButton, TierBadge } from "./ui";

interface Props {
  kycTier: KycTier;
  busy: boolean;
  onUpgrade: (tier: "TIER_1" | "TIER_2") => Promise<void>;
  onContinue: () => void;
}

export function Kyc({ kycTier, busy, onUpgrade, onContinue }: Props) {
  return (
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Identity verification</Text>
      <TierBadge label={kycTier.replace("_", " ")} />
      <Text>
        Transfer limit at this tier: {KYC_TIER_TRANSFER_LIMITS_MINOR[kycTier].toLocaleString()} minor units
        per transaction.
      </Text>
      {kycTier === "TIER_0" && (
        <PrimaryButton title="Upgrade to Tier 1 (basic ID)" disabled={busy} onPress={() => onUpgrade("TIER_1")} />
      )}
      {kycTier === "TIER_1" && (
        <PrimaryButton title="Upgrade to Tier 2 (full KYC)" disabled={busy} onPress={() => onUpgrade("TIER_2")} />
      )}
      <SecondaryButton title="Continue to wallet" disabled={busy} onPress={onContinue} />
    </Card>
  );
}
