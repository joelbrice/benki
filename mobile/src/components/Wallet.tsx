import { useState } from "react";
import { Text, View } from "react-native";
import { COUNTRY_BY_CODE, formatAmount, type UserProfile, type WalletAccount } from "../types";
import { Card, ChipSelect, Field, PrimaryButton, SecondaryButton } from "./ui";
import { colors } from "../theme/colors";

interface Props {
  user: UserProfile;
  wallet: WalletAccount | null;
  busy: boolean;
  onCreateWallet: () => Promise<void>;
  onCashIn: (amountMinor: number, agentId: string) => Promise<void>;
  onCashOut: (amountMinor: number, agentId: string) => Promise<void>;
  onAirtimeTopUp: (amountMinor: number, providerId: string) => Promise<void>;
  onContinue: () => void;
}

export function Wallet({ user, wallet, busy, onCreateWallet, onCashIn, onCashOut, onAirtimeTopUp, onContinue }: Props) {
  const country = COUNTRY_BY_CODE[user.countryCode];
  const [agentId, setAgentId] = useState(country?.agents[0]?.id ?? "");
  const [cashAmount, setCashAmount] = useState("10000");
  const [providerId, setProviderId] = useState(country?.mobileMoneyProviders[0]?.id ?? "");
  const [airtimeAmount, setAirtimeAmount] = useState("1000");

  if (!country) return null;

  return (
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Wallet</Text>
      {!wallet ? (
        <PrimaryButton title="Create wallet" disabled={busy} onPress={onCreateWallet} />
      ) : (
        <>
          <Text style={{ fontSize: 30, fontWeight: "700" }}>
            {formatAmount(wallet.availableBalanceMinor, wallet.currency)}
          </Text>
          <Text>Wallet ID: {wallet.walletId}</Text>

          <View style={{ borderWidth: 1, borderColor: colors.secondaryBg, borderRadius: 10, padding: 14, gap: 10 }}>
            <Text style={{ fontWeight: "700" }}>Cash-in / cash-out via agent</Text>
            <ChipSelect
              label="Agent"
              value={agentId}
              onChange={setAgentId}
              options={country.agents.map((a) => ({ id: a.id, label: `${a.name} — ${a.location}` }))}
            />
            <Field label="Amount (minor units)" value={cashAmount} onChangeText={setCashAmount} keyboardType="number-pad" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  title="Cash-in"
                  disabled={busy || !Number(cashAmount)}
                  onPress={() => onCashIn(Number(cashAmount), agentId)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SecondaryButton
                  title="Cash-out"
                  disabled={busy || !Number(cashAmount)}
                  onPress={() => onCashOut(Number(cashAmount), agentId)}
                />
              </View>
            </View>
          </View>

          <View style={{ borderWidth: 1, borderColor: colors.secondaryBg, borderRadius: 10, padding: 14, gap: 10 }}>
            <Text style={{ fontWeight: "700" }}>Airtime / data top-up</Text>
            <ChipSelect
              label="Mobile network"
              value={providerId}
              onChange={setProviderId}
              options={country.mobileMoneyProviders.map((p) => ({ id: p.id, label: p.label }))}
            />
            <Field
              label="Amount (minor units)"
              value={airtimeAmount}
              onChangeText={setAirtimeAmount}
              keyboardType="number-pad"
            />
            <PrimaryButton
              title="Top up airtime"
              disabled={busy || !Number(airtimeAmount)}
              onPress={() => onAirtimeTopUp(Number(airtimeAmount), providerId)}
            />
          </View>

          <SecondaryButton title="Continue to transfer" disabled={busy} onPress={onContinue} />
        </>
      )}
    </Card>
  );
}
