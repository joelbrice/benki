import { useState } from "react";
import { Text } from "react-native";
import type { WalletAccount } from "../types";
import { Card, Field, PrimaryButton } from "./ui";

interface Props {
  wallet: WalletAccount;
  busy: boolean;
  onSend: (destinationPhoneNumber: string, amountMinor: number, note: string) => Promise<void>;
}

export function Transfer({ wallet, busy, onSend }: Props) {
  const [destination, setDestination] = useState("+221700000002");
  const [amount, setAmount] = useState("15000");
  const [note, setNote] = useState("");

  const amountMinor = Number(amount);
  const canSubmit = destination.trim().length > 0 && Number.isFinite(amountMinor) && amountMinor > 0;

  return (
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Send money</Text>
      <Text>
        Available balance: {wallet.availableBalanceMinor.toLocaleString()} {wallet.currency}
      </Text>
      <Field label="Recipient phone number" value={destination} onChangeText={setDestination} keyboardType="phone-pad" />
      <Field label="Amount (minor units)" value={amount} onChangeText={setAmount} keyboardType="number-pad" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      <PrimaryButton
        title="Send internal transfer"
        disabled={busy || !canSubmit}
        onPress={() => onSend(destination, amountMinor, note)}
      />
    </Card>
  );
}
