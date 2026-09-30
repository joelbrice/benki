import { useState } from "react";
import { Text, View } from "react-native";
import { COUNTRY_BY_CODE, formatAmount, transferLimitMinor, type UserProfile } from "../types";
import { Card, Checkbox, Field, PrimaryButton, SecondaryButton, TierBadge } from "./ui";
import { colors } from "../theme/colors";

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
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Identity verification</Text>
      <TierBadge label={user.kycTier.replace(/_/g, " ")} />
      <Text>
        Transfer limit at this tier: {formatAmount(transferLimitMinor(user.countryCode, user.kycTier), currency)}{" "}
        per transaction.
      </Text>

      {user.kycTier === "TIER_0" && (
        <View style={{ borderWidth: 1, borderColor: colors.secondaryBg, borderRadius: 10, padding: 14, gap: 10 }}>
          <Text>Tier 1 requires a national ID number.</Text>
          <Field label="National ID number" value={nationalId} onChangeText={setNationalId} />
          <PrimaryButton
            title="Upgrade to Tier 1"
            disabled={busy || !nationalId.trim()}
            onPress={() => onUpgradeTier1(nationalId)}
          />
        </View>
      )}

      {user.kycTier === "TIER_1" && (
        <View style={{ borderWidth: 1, borderColor: colors.secondaryBg, borderRadius: 10, padding: 14, gap: 10 }}>
          <Text>Tier 2 requires a selfie/liveness check and proof of address.</Text>
          <Checkbox
            label="I confirm my selfie and proof of address were captured"
            checked={confirmed}
            onToggle={() => setConfirmed((v) => !v)}
          />
          <PrimaryButton title="Upgrade to Tier 2" disabled={busy || !confirmed} onPress={onUpgradeTier2} />
        </View>
      )}

      <SecondaryButton title="Continue to wallet" disabled={busy} onPress={onContinue} />
    </Card>
  );
}
