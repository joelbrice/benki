import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { FX_MARGIN_BPS, parseMajorToMinor, POCKET_CURRENCIES, pocketsAllowed, type CurrencyPocket } from "@benki/shared";
import { AmountField, Banner, Card, Muted, PrimaryButton, ScreenHeader, SecondaryButton, Segmented, useAction } from "../components/ui";
import { useI18n } from "../i18n";
import type { Session } from "../session";
import { colors } from "../theme/colors";
import { useIntent } from "./flow";

export function Currencies({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { api, wallet, user } = session;
  const [pockets, setPockets] = useState<CurrencyPocket[]>([]);
  const [active, setActive] = useState("USD");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const { busy, error, run } = useAction();
  const load = useCallback(() => api.pockets().then((r) => setPockets(r.pockets), () => undefined), [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const { setIntent, screen } = useIntent(session, () => {
    setAmount("");
    void load();
  });
  if (screen) return screen;

  if (!pocketsAllowed(user.countryCode)) {
    return (
      <>
        <ScreenHeader title={t("fx.title")} />
        <Banner tone="info">{t("err.pocketZone")}</Banner>
      </>
    );
  }

  if (user.kycTier === "TIER_0") {
    return (
      <>
        <ScreenHeader title={t("fx.title")} subtitle={t("fx.intro")} />
        <Banner tone="warn">{t("fx.tier")}</Banner>
      </>
    );
  }

  const pocket = pockets.find((p) => p.currency === active);
  const from = direction === "buy" ? wallet.currency : active;
  const to = direction === "buy" ? active : wallet.currency;
  const sellMinor = parseMajorToMinor(amount, from);

  return (
    <>
      <ScreenHeader title={t("fx.title")} subtitle={t("fx.intro")} />
      <View style={{ backgroundColor: colors.hero, borderRadius: 20, padding: 18, gap: 4 }}>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>{t("fx.wallet")}</Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "800" }}>{money(wallet.availableBalanceMinor, wallet.currency)}</Text>
      </View>
      {POCKET_CURRENCIES.map((c) => {
        const p = pockets.find((x) => x.currency === c);
        return (
          <Card key={c} highlight={active === c && !!p}>
            <Muted>{c}</Muted>
            {p ? (
              <>
                <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{money(p.balanceMinor, c)}</Text>
                <Muted>{t("fx.worth", { amount: money(p.localEquivalentMinor, wallet.currency) })}</Muted>
                <SecondaryButton title={t("quick.convert")} icon="repeat" onPress={() => setActive(c)} />
              </>
            ) : (
              <PrimaryButton
                title={t("fx.open", { currency: c })}
                icon="plus"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    setPockets((await api.openPocket(c)).pockets);
                    setActive(c);
                  })
                }
              />
            )}
          </Card>
        );
      })}
      {pocket && (
        <Card>
          <Segmented
            value={direction}
            onChange={(d) => {
              setDirection(d);
              setAmount("");
            }}
            options={[
              { id: "buy", label: t("fx.buy", { currency: active }) },
              { id: "sell", label: t("fx.sell", { currency: active }) },
            ]}
          />
          <AmountField label={t("fx.youPay")} currency={from} value={amount} onChange={setAmount} />
          <Muted>{t("fx.margin", { percent: FX_MARGIN_BPS / 100 })}</Muted>
          <PrimaryButton
            title={t("fx.getQuote")}
            disabled={busy || !sellMinor}
            onPress={() =>
              run(async () => {
                const q = await api.conversionQuote(from, to, sellMinor!);
                setIntent({
                  title: t("fx.convertTitle", { from, to }),
                  rows: [
                    [t("fx.youPay"), money(q.sellAmountMinor, q.fromCurrency)],
                    [t("send.rate"), t("send.rateLine", { from: q.fromCurrency, rate: String(q.rate), to: q.toCurrency })],
                    [t("send.lockedUntil"), date(q.expiresAt, true)],
                    [t("fx.youGet"), money(q.buyAmountMinor, q.toCurrency)],
                  ],
                  currency: q.fromCurrency,
                  amountMinor: q.sellAmountMinor,
                  requirePin: true,
                  submit: (pin, idempotencyKey) => api.convert({ idempotencyKey, pin, quoteId: q.quoteId }),
                });
              })
            }
          />
        </Card>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </>
  );
}
