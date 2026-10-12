import { useState } from "react";
import { parseMajorToMinor, type MessageKey } from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, Banner, hintLabel, PageHeader, Segmented, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

type Mode = "bills" | "merchant" | "airtime";

export function Pay({ session }: { session: Session }) {
  const { t, money } = useI18n();
  const { api, country, wallet, user } = session;
  const [mode, setMode] = useState<Mode>(session.preset === "airtime" || session.preset === "merchant" ? session.preset : "bills");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [amount, setAmount] = useState("");
  const [billerId, setBillerId] = useState(country.billers[0].id);
  const [accountNumber, setAccountNumber] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [providerId, setProviderId] = useState(country.mobileMoneyProviders[0].id);
  const [airtimePhone, setAirtimePhone] = useState(user.phoneNumber);
  const { error, setError } = useAction();

  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const biller = country.billers.find((b) => b.id === billerId)!;
  const billerLabel = (b: typeof biller) => `${t(`biller.${b.category}` as MessageKey)} — ${b.name}`;
  const reset = () => {
    setIntent(null);
    setAmount("");
    void session.refresh();
  };

  if (intent) return <ConfirmPayment api={api} intent={intent} onDone={reset} onCancel={() => setIntent(null)} />;

  const review = () => {
    if (!amountMinor) return setError(t("common.invalidAmount"));
    setError(null);
    const amountRow: [string, string] = [t("common.amount"), money(amountMinor, wallet.currency)];
    if (mode === "bills") {
      if (!new RegExp(biller.accountNumberPattern).test(accountNumber.trim().toUpperCase())) {
        return setError(t("err.invalidAccountNumber", { hint: hintLabel(biller.accountNumberHint, t) }));
      }
      setIntent({
        title: billerLabel(biller),
        rows: [[hintLabel(biller.accountNumberHint, t), accountNumber], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "BILL_PAYMENT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.bill({ idempotencyKey, pin, billerId, accountNumber, amountMinor }),
      });
    } else if (mode === "merchant") {
      const merchant = country.merchants.find((m) => m.code === merchantCode.trim().toUpperCase());
      setIntent({
        title: t("pay.payMerchant"),
        rows: [[t("pay.merchant"), merchant ? `${merchant.name} (${merchant.code})` : merchantCode], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "MERCHANT_PAYMENT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.merchant({ idempotencyKey, pin, merchantCode, amountMinor }),
      });
    } else {
      const provider = country.mobileMoneyProviders.find((p) => p.id === providerId)!;
      setIntent({
        title: t("pay.buyAirtime"),
        rows: [[t("pay.network"), provider.label], [t("common.phone"), airtimePhone], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "AIRTIME",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.airtime(wallet.walletId, { idempotencyKey, pin, providerId, phoneNumber: airtimePhone, amountMinor }),
      });
    }
  };

  return (
    <div className="stack">
      <PageHeader title={t("pay.title")} />
      <div className="card">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { id: "bills", label: t("pay.bills"), icon: "pay" },
            { id: "merchant", label: t("pay.merchant"), icon: "store" },
            { id: "airtime", label: t("pay.airtime"), icon: "zap" },
          ]}
        />

        {mode === "bills" && (
          <>
            <label htmlFor="biller">
              {t("pay.biller")}
              <select id="biller" value={billerId} onChange={(e) => setBillerId(e.target.value)}>
                {country.billers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {billerLabel(b)}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="bill-account">
              {hintLabel(biller.accountNumberHint, t)}
              <input id="bill-account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </label>
            {biller.issuesToken && <p className="muted small">{t("pay.tokenHint")}</p>}
          </>
        )}
        {mode === "merchant" && (
          <>
            <label htmlFor="merchant-code">
              {t("pay.merchantCode")}
              <input id="merchant-code" value={merchantCode} onChange={(e) => setMerchantCode(e.target.value.toUpperCase())} />
            </label>
            <span className="muted small">{t("pay.nearby")}</span>
            <div className="chips">
              {country.merchants.map((m) => (
                <button key={m.code} className={`chip${merchantCode === m.code ? " active" : ""}`} onClick={() => setMerchantCode(m.code)}>
                  {m.name}
                </button>
              ))}
            </div>
          </>
        )}
        {mode === "airtime" && (
          <div className="field-row">
            <label htmlFor="airtime-network">
              {t("pay.network")}
              <select id="airtime-network" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {country.mobileMoneyProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="airtime-phone">
              {t("common.phone")}
              <input id="airtime-phone" inputMode="tel" value={airtimePhone} onChange={(e) => setAirtimePhone(e.target.value.replace(/[^\d+]/g, ""))} />
            </label>
          </div>
        )}
        <AmountField id="pay-amount" currency={wallet.currency} value={amount} onChange={setAmount} />
        {error && <Banner tone="error">{error}</Banner>}
        <button className="block" disabled={!amountMinor} onClick={review}>
          {t("common.review")}
        </button>
      </div>
    </div>
  );
}
