import { useState } from "react";
import { Text } from "react-native";
import { Card, Field, PrimaryButton } from "./ui";

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
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Sign in</Text>
      {!otpSent ? (
        <>
          <Field label="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
          <Field label="Country" value={country} onChangeText={setCountry} />
          <PrimaryButton
            title="Send OTP"
            disabled={busy || !phoneNumber.trim() || !country.trim()}
            onPress={() => onRequestOtp(phoneNumber, country)}
          />
        </>
      ) : (
        <>
          <Text>An OTP was sent to {phoneNumber}. Enter it below.</Text>
          <Field label="One-time code" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
          <PrimaryButton title="Verify & continue" disabled={busy || !otp.trim()} onPress={() => onVerify(otp)} />
        </>
      )}
    </Card>
  );
}
