import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  COUNTRY_BY_CODE,
  LIVE_COUNTRIES,
  PLANNED_COUNTRIES,
  type Region,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_LOCALE_BY_COUNTRY,
  USSD_SHORT_CODE,
  type MessageKey,
} from "@benki/shared";
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
  const [waitlist, setWaitlist] = useState(false);
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
            <Text style={styles.pointText}>{t(k, { count: LIVE_COUNTRIES.length })}</Text>
          </View>
        ))}
        <Text style={styles.flags}>{LIVE_COUNTRIES.map((c) => c.flag).join("  ")}</Text>
        <Text style={styles.soon}>{t("onboarding.comingSoonLine", { count: PLANNED_COUNTRIES.length })}</Text>
      </View>

      {waitlist ? (
        <Waitlist onBack={() => setWaitlist(false)} />
      ) : (
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
                // Launched markets only, Cameroon first; the rest are listed under the hero as coming soon.
                options={LIVE_COUNTRIES.map((c) => ({ id: c.code, label: `${c.flag} ${t(`country.${c.code}` as MessageKey)}` }))}
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
              <GhostButton title={t("waitlist.cta")} onPress={() => setWaitlist(true)} />
            </>
          ) : (
            <>
              <Muted>{t("onboarding.codeSent", { phone })}</Muted>
              {devOtp && <Banner tone="warn">{t("onboarding.sandboxCode", { code: devOtp })}</Banner>}
              <Field label={t("onboarding.code")} value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" />
              <PrimaryButton
                title={t("onboarding.verify")}
                disabled={busy || otp.length !== 6}
                onPress={() => run(async () => onSignedIn((await authApi.verifyOtp(phone, otp, locale)).token))}
              />
              <GhostButton title={t("onboarding.changeNumber")} onPress={() => setOtpSent(false)} />
            </>
          )}
          {error && <Banner tone="error">{error}</Banner>}
          <Muted>{t("onboarding.safety")}</Muted>
          <Muted>{t("onboarding.ussd", { code: USSD_SHORT_CODE })}</Muted>
        </Card>
      )}
    </>
  );
}

const REGIONS: Region[] = ["CENTRAL", "WEST", "EAST", "SOUTHERN", "NORTH"];

/** Planned markets: leave a number to get one SMS when Benki launches there. */
function Waitlist({ onBack }: { onBack: () => void }) {
  const { t, locale } = useI18n();
  const regions = REGIONS.filter((r) => PLANNED_COUNTRIES.some((c) => c.region === r));
  const [region, setRegion] = useState<Region>(regions[0]);
  const inRegion = PLANNED_COUNTRIES.filter((c) => c.region === region);
  const [countryCode, setCountryCode] = useState(inRegion[0].code);
  const [phone, setPhone] = useState(COUNTRY_BY_CODE[countryCode].callingCode);
  const [joined, setJoined] = useState(false);
  const { busy, error, run } = useAction();
  const country = t(`country.${countryCode}` as MessageKey);
  const choose = (code: string) => {
    setCountryCode(code);
    setPhone(COUNTRY_BY_CODE[code].callingCode);
    setJoined(false);
  };
  return (
    <Card>
      <Title>{t("waitlist.title", { country })}</Title>
      <Muted>{t("waitlist.body")}</Muted>
      <ChipSelect
        value={region}
        onChange={(r) => {
          setRegion(r);
          choose(PLANNED_COUNTRIES.find((c) => c.region === r)!.code);
        }}
        options={regions.map((r) => ({ id: r, label: t(`region.${r}`) }))}
      />
      <ChipSelect
        label={t("onboarding.country")}
        value={countryCode}
        onChange={choose}
        options={inRegion.map((c) => ({ id: c.code, label: `${c.flag} ${t(`country.${c.code}` as MessageKey)}` }))}
      />
      {joined ? (
        <Banner tone="success">{t("waitlist.joined", { phone, country })}</Banner>
      ) : (
        <>
          <Field label={t("onboarding.phone")} value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
          <PrimaryButton
            title={t("waitlist.join")}
            disabled={busy || phone.length < 9}
            onPress={() =>
              run(async () => {
                await authApi.joinWaitlist(phone, countryCode, locale);
                setJoined(true);
              })
            }
          />
        </>
      )}
      {error && <Banner tone="error">{error}</Banner>}
      <GhostButton title={t("waitlist.back")} onPress={onBack} />
    </Card>
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
  flags: { fontSize: 22, marginTop: 4, lineHeight: 32 },
  soon: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
});
