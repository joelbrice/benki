import { useState } from "react";
import { AFRICAN_COUNTRIES, COUNTRY_BY_CODE, DEFAULT_COUNTRY_CODE } from "@benki/shared";
import { authApi, type CustomerApi } from "../api";
import { Banner, Card, ChipSelect, Field, GhostButton, Muted, PrimaryButton, Title, useAction } from "../components/ui";

export function Onboarding({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState(COUNTRY_BY_CODE[DEFAULT_COUNTRY_CODE].callingCode);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const { busy, error, run } = useAction();

  return (
    <Card>
      <Title>{otpSent ? "Enter your code" : "Sign in or create an account"}</Title>
      {!otpSent ? (
        <>
          <ChipSelect
            label="Country"
            value={countryCode}
            onChange={(code) => {
              setCountryCode(code);
              setPhone(COUNTRY_BY_CODE[code].callingCode);
            }}
            options={AFRICAN_COUNTRIES.map((c) => ({ id: c.code, label: `${c.name} (${c.currency})` }))}
          />
          <Field label="Mobile number" value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
          <PrimaryButton
            title="Send code by SMS"
            disabled={busy || phone.length < 9}
            onPress={() =>
              run(async () => {
                const res = await authApi.sendOtp(phone, countryCode);
                setDevOtp(res.devOtp ?? null);
                setOtpSent(true);
              })
            }
          />
        </>
      ) : (
        <>
          <Muted>We sent a 6-digit code to {phone}. It expires in 5 minutes.</Muted>
          {devOtp && <Banner tone="warn">Sandbox: no SMS gateway is connected, so your code is {devOtp}.</Banner>}
          <Field label="One-time code" value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
          <PrimaryButton title="Verify" disabled={busy || otp.length !== 6} onPress={() => run(async () => onSignedIn((await authApi.verifyOtp(phone, otp)).token))} />
          <GhostButton title="Change number" onPress={() => setOtpSent(false)} />
        </>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <Muted>Your session is tied to this phone. Never share your code or PIN — Benki staff will never ask for them.</Muted>
    </Card>
  );
}

export function SetPin({ api, onDone }: { api: CustomerApi; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, setError, run } = useAction();
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);
  return (
    <Card>
      <Title>Create your transaction PIN</Title>
      <Muted>You'll enter this PIN to approve every payment. Avoid birthdays, repeated digits or sequences like 1234.</Muted>
      <Field label="PIN (4–6 digits)" value={pin} onChangeText={(v) => setPin(digits(v))} keyboardType="number-pad" secureTextEntry />
      <Field label="Confirm PIN" value={confirm} onChangeText={(v) => setConfirm(digits(v))} keyboardType="number-pad" secureTextEntry />
      {error && <Banner tone="error">{error}</Banner>}
      <PrimaryButton
        title="Save PIN"
        disabled={busy || pin.length < 4}
        onPress={() => {
          if (pin !== confirm) return setError("The PINs don't match");
          run(async () => {
            await api.setPin(pin);
            onDone();
          });
        }}
      />
    </Card>
  );
}
