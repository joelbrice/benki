import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AFRICAN_COUNTRIES, COUNTRY_BY_CODE, DEFAULT_COUNTRY_CODE, DEFAULT_LOCALE_BY_COUNTRY, USSD_SHORT_CODE, type MessageKey } from "@benki/shared";
import { authApi, type CustomerApi } from "../api";
import { Banner, Card, ChipSelect, Field, GhostButton, Icon, LanguagePicker, Muted, PinField, PrimaryButton, Title, useAction } from "../components/ui";
import { useI18n } from "../i18n";
import { colors } from "../theme/colors";

export function Onboarding({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const { t, locale, setLocale } = useI18n();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState(COUNTRY_BY_CODE[DEFAULT_COUNTRY_CODE].callingCode);
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [languageTouched, setLanguageTouched] = useState(false);
  const { busy, error, run } = useAction();

  return (
    <>
      <View style={styles.hero}>
        <View style={styles.heroDecor} />
        <Text style={styles.heroTitle}>{t("onboarding.heroTitle")}</Text>
        <Text style={styles.heroBody}>{t("onboarding.heroBody")}</Text>
        {(["onboarding.point1", "onboarding.point2", "onboarding.point3"] as const).map((k, i) => (
          <View key={k} style={styles.point}>
            <View style={styles.pointIcon}>
              <Icon name={(["arrow-up-right", "globe", "shield"] as const)[i]} size={14} color="#fff" />
            </View>
            <Text style={styles.pointText}>{t(k)}</Text>
          </View>
        ))}
        <Text style={styles.flags}>{AFRICAN_COUNTRIES.map((c) => c.flag).join("  ")}</Text>
      </View>

      <Card>
        <Title>{otpSent ? t("onboarding.enterCode") : t("onboarding.title")}</Title>
        <LanguagePicker countryCode={countryCode} onChange={() => setLanguageTouched(true)} />
        {!otpSent ? (
          <>
            <ChipSelect
              label={t("onboarding.country")}
              value={countryCode}
              onChange={(code) => {
                setCountryCode(code);
                setPhone(COUNTRY_BY_CODE[code].callingCode);
                const native = DEFAULT_LOCALE_BY_COUNTRY[code] ?? "en";
                if (!languageTouched && locale !== native) setLocale(native);
              }}
              options={AFRICAN_COUNTRIES.map((c) => ({ id: c.code, label: `${c.flag} ${t(`country.${c.code}` as MessageKey)}` }))}
            />
            <Field label={t("onboarding.phone")} value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
            <PrimaryButton
              title={t("onboarding.sendCode")}
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
            <Muted>{t("onboarding.codeSent", { phone })}</Muted>
            {devOtp && <Banner tone="warn">{t("onboarding.sandboxCode", { code: devOtp })}</Banner>}
            <Field label={t("onboarding.code")} value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
            <PrimaryButton
              title={t("onboarding.verify")}
              disabled={busy || otp.length !== 6}
              onPress={() => run(async () => onSignedIn((await authApi.verifyOtp(phone, otp)).token))}
            />
            <GhostButton title={t("onboarding.changeNumber")} onPress={() => setOtpSent(false)} />
          </>
        )}
        {error && <Banner tone="error">{error}</Banner>}
        <Muted>{t("onboarding.safety")}</Muted>
        <Muted>{t("onboarding.ussd", { code: USSD_SHORT_CODE })}</Muted>
      </Card>
    </>
  );
}

export function SetPin({ api, onDone }: { api: CustomerApi; onDone: () => void }) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const { busy, error, setError, run } = useAction();
  return (
    <Card>
      <Title>{t("setPin.title")}</Title>
      <Muted>{t("setPin.body")}</Muted>
      <PinField label={t("setPin.pin")} value={pin} onChange={setPin} />
      <PinField label={t("setPin.confirm")} value={confirm} onChange={setConfirm} />
      {error && <Banner tone="error">{error}</Banner>}
      <PrimaryButton
        title={t("setPin.save")}
        disabled={busy || pin.length < 4}
        onPress={() => {
          if (pin !== confirm) return setError(t("setPin.mismatch"));
          void run(async () => {
            await api.setPin(pin);
            onDone();
          });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.hero, borderRadius: 26, padding: 24, gap: 12, overflow: "hidden" },
  heroDecor: { position: "absolute", right: -60, top: -60, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.accent, opacity: 0.35 },
  heroTitle: { color: "#fff", fontSize: 28, fontWeight: "800", lineHeight: 33 },
  heroBody: { color: "rgba(255,255,255,0.85)", fontSize: 15, lineHeight: 21 },
  point: { flexDirection: "row", alignItems: "center", gap: 10 },
  pointIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  pointText: { color: "#fff", fontWeight: "600", flex: 1 },
  flags: { fontSize: 22, marginTop: 4 },
});
