import { useState } from "react";
import { Text, View } from "react-native";
import { COUNTRY_BY_CODE, formatAmount, type UserProfile, type WalletAccount } from "../types";
import { Card, ChipSelect, Field, PrimaryButton } from "./ui";

interface Props {
  user: UserProfile;
  wallet: WalletAccount;
  busy: boolean;
  onSendInternal: (destinationPhoneNumber: string, amountMinor: number, note: string) => Promise<void>;
  onSendMobileMoney: (providerId: string, destinationPhoneNumber: string, amountMinor: number) => Promise<void>;
}

export function Transfer({ user, wallet, busy, onSendInternal, onSendMobileMoney }: Props) {
  const country = COUNTRY_BY_CODE[user.countryCode];
  const [mode, setMode] = useState<"internal" | "momo">("internal");

  const [destination, setDestination] = useState("+221700000002");
  const [amount, setAmount] = useState("15000");
  const [note, setNote] = useState("");

  const [momoProviderId, setMomoProviderId] = useState(country?.mobileMoneyProviders[0]?.id ?? "");
  const [momoDestination, setMomoDestination] = useState("");
  const [momoAmount, setMomoAmount] = useState("5000");

  const amountMinor = Number(amount);
  const canSubmitInternal = destination.trim().length > 0 && Number.isFinite(amountMinor) && amountMinor > 0;

  const momoAmountMinor = Number(momoAmount);
  const canSubmitMomo =
    momoDestination.trim().length > 0 && Number.isFinite(momoAmountMinor) && momoAmountMinor > 0;

  return (
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Send money</Text>
      <Text>Available balance: {formatAmount(wallet.availableBalanceMinor, wallet.currency)}</Text>

      <ChipSelect
        label="Send to"
        value={mode}
        onChange={setMode}
        options={[
          { id: "internal", label: "Benki user" },
          { id: "momo", label: "Mobile money" },
        ]}
      />

      {mode === "internal" ? (
        <>
          <Field label="Recipient phone number" value={destination} onChangeText={setDestination} keyboardType="phone-pad" />
          <Field label="Amount (minor units)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
          <Field label="Note (optional)" value={note} onChangeText={setNote} />
          <PrimaryButton
            title="Send internal transfer"
            disabled={busy || !canSubmitInternal}
            onPress={() => onSendInternal(destination, amountMinor, note)}
          />
        </>
      ) : (
        <>
          <ChipSelect
            label="Mobile money provider"
            value={momoProviderId}
            onChange={setMomoProviderId}
            options={country?.mobileMoneyProviders.map((p) => ({ id: p.id, label: p.label })) ?? []}
          />
          <Field
            label="Recipient phone number"
            value={momoDestination}
            onChangeText={setMomoDestination}
            keyboardType="phone-pad"
          />
          <Field label="Amount (minor units)" value={momoAmount} onChangeText={setMomoAmount} keyboardType="number-pad" />
          <PrimaryButton
            title="Send via mobile money"
            disabled={busy || !canSubmitMomo}
            onPress={() => onSendMobileMoney(momoProviderId, momoDestination, momoAmountMinor)}
          />
        </>
      )}
    </Card>
  );
}
