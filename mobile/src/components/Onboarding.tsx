import { useState } from "react";
import { Text } from "react-native";
import { AFRICAN_COUNTRIES, DEFAULT_COUNTRY_CODE } from "../types";
import { Card, ChipSelect, Field, PrimaryButton } from "./ui";

interface Props {
  onRequestOtp: (phoneNumber: string, countryCode: string) => Promise<void>;
  onVerify: (otp: string) => Promise<void>;
  otpSent: boolean;
  busy: boolean;
}

export function Onboarding({ onRequestOtp, onVerify, otpSent, busy }: Props) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phoneNumber, setPhoneNumber] = useState("+221700000001");
  const [otp, setOtp] = useState("");

  return (
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Sign in</Text>
      {!otpSent ? (
        <>
          <ChipSelect
            label="Country"
            value={countryCode}
            onChange={setCountryCode}
            options={AFRICAN_COUNTRIES.map((c) => ({ id: c.code, label: `${c.name} (${c.currency})` }))}
          />
          <Field label="Phone number" value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
          <PrimaryButton
            title="Send OTP"
            disabled={busy || !phoneNumber.trim()}
            onPress={() => onRequestOtp(phoneNumber, countryCode)}
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
