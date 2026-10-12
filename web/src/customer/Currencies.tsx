import { useCallback, useEffect, useState } from "react";
import { FX_MARGIN_BPS, parseMajorToMinor, POCKET_CURRENCIES, type CurrencyPocket } from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, Banner, PageHeader, Segmented, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import { Icon } from "../ui/icons";
import type { Session } from "./session";

/** Hold hard currency next to the local wallet; convert at a disclosed rate. */
export function Currencies({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { api, wallet, user } = session;
  const [pockets, setPockets] = useState<CurrencyPocket[]>([]);
  const [active, setActive] = useState<string>("USD");
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { busy, error, run } = useAction();

  const load = useCallback(() => api.pockets().then((r) => setPockets(r.pockets), () => undefined), [api]);
  useEffect(() => {
    void load();
  }, [load]);

  if (intent) {
    return (
      <ConfirmPayment
        api={api}
        intent={intent}
        onDone={() => {
          setIntent(null);
          setAmount("");
          void load();
          void session.refresh();
        }}
        onCancel={() => setIntent(null)}
      />
    );
  }

  if (user.kycTier === "TIER_0") {
    return (
      <div className="stack">
        <PageHeader title={t("fx.title")} subtitle={t("fx.intro")} />
        <Banner tone="warn">{t("fx.tier")}</Banner>
      </div>
    );
  }

  const pocket = pockets.find((p) => p.currency === active);
  const from = direction === "buy" ? wallet.currency : active;
  const to = direction === "buy" ? active : wallet.currency;
  const sellMinor = parseMajorToMinor(amount, from);

  const quote = () =>
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
    });

  return (
    <div className="stack">
      <PageHeader title={t("fx.title")} subtitle={t("fx.intro")} />
      <div className="card-grid">
        <section className="card currency-card local">
          <span className="muted small">{t("fx.wallet")}</span>
          <strong className="currency-amount">{money(wallet.availableBalanceMinor, wallet.currency)}</strong>
        </section>
        {POCKET_CURRENCIES.map((c) => {
          const p = pockets.find((x) => x.currency === c);
          return (
            <section key={c} className={`card currency-card${active === c ? " selected" : ""}`}>
              <span className="muted small">{c}</span>
              {p ? (
                <>
                  <strong className="currency-amount">{money(p.balanceMinor, c)}</strong>
                  <span className="muted small">{t("fx.worth", { amount: money(p.localEquivalentMinor, wallet.currency) })}</span>
                  <button className="small secondary" onClick={() => setActive(c)}>
                    <Icon name="convert" size={14} /> {t("quick.convert")}
                  </button>
                </>
              ) : (
                <button
                  className="small"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      setPockets((await api.openPocket(c)).pockets);
                      setActive(c);
                    })
                  }
                >
                  <Icon name="plus" size={14} /> {t("fx.open", { currency: c })}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {pocket && (
        <section className="card">
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
          <AmountField id="fx-amount" label={t("fx.youPay")} currency={from} value={amount} onChange={setAmount} />
          <p className="muted small">{t("fx.margin", { percent: FX_MARGIN_BPS / 100 })}</p>
          <button className="block" disabled={busy || !sellMinor} onClick={quote}>
            {t("fx.getQuote")}
          </button>
        </section>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </div>
  );
}
