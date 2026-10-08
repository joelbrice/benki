import { useState } from "react";
import { formatAmount, parseMajorToMinor } from "@benki/shared";
import { AmountField, Banner, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

type Mode = "bills" | "merchant" | "airtime";

export function Pay({ session }: { session: Session }) {
  const { api, country, wallet, user } = session;
  const [mode, setMode] = useState<Mode>("bills");
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
  const reset = () => {
    setIntent(null);
    setAmount("");
    void session.refresh();
  };

  if (intent) return <ConfirmPayment api={api} intent={intent} onDone={reset} onCancel={() => setIntent(null)} />;

  const review = () => {
    if (!amountMinor) return setError("Enter a valid amount");
    setError(null);
    const amountRow: [string, string] = ["Amount", formatAmount(amountMinor, wallet.currency)];
    if (mode === "bills") {
      if (!new RegExp(biller.accountNumberPattern).test(accountNumber.trim().toUpperCase())) {
        return setError(`Enter a valid ${biller.accountNumberHint.toLowerCase()}`);
      }
      setIntent({
        title: biller.name,
        rows: [[biller.accountNumberHint, accountNumber], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "BILL_PAYMENT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.bill({ idempotencyKey, pin, billerId, accountNumber, amountMinor }),
      });
    } else if (mode === "merchant") {
      const merchant = country.merchants.find((m) => m.code === merchantCode.trim().toUpperCase());
      setIntent({
        title: "Pay merchant",
        rows: [["Merchant", merchant ? `${merchant.name} (${merchant.code})` : merchantCode], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "MERCHANT_PAYMENT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.merchant({ idempotencyKey, pin, merchantCode, amountMinor }),
      });
    } else {
      const provider = country.mobileMoneyProviders.find((p) => p.id === providerId)!;
      setIntent({
        title: "Buy airtime",
        rows: [["Network", provider.label], ["Phone", airtimePhone], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "AIRTIME",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.airtime(wallet.walletId, { idempotencyKey, pin, providerId, phoneNumber: airtimePhone, amountMinor }),
      });
    }
  };

  return (
    <div className="card">
      <h2>Pay</h2>
      <div className="segmented" role="tablist">
        {(
          [
            ["bills", "Bills"],
            ["merchant", "Merchant"],
            ["airtime", "Airtime"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "active" : undefined} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>

      {mode === "bills" && (
        <>
          <label htmlFor="biller">
            Biller
            <select id="biller" value={billerId} onChange={(e) => setBillerId(e.target.value)}>
              {country.billers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="bill-account">
            {biller.accountNumberHint}
            <input id="bill-account" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </label>
          {biller.issuesToken && <p className="muted small">You'll get a 20-digit token to enter on your meter.</p>}
        </>
      )}
      {mode === "merchant" && (
        <>
          <label htmlFor="merchant-code">
            Merchant code (from the shop's QR sticker)
            <input id="merchant-code" value={merchantCode} onChange={(e) => setMerchantCode(e.target.value)} />
          </label>
          <div className="row">
            {country.merchants.map((m) => (
              <button key={m.code} className="small ghost" onClick={() => setMerchantCode(m.code)}>
                {m.name}
              </button>
            ))}
          </div>
        </>
      )}
      {mode === "airtime" && (
        <>
          <label htmlFor="airtime-network">
            Network
            <select id="airtime-network" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {country.mobileMoneyProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="airtime-phone">
            Phone number
            <input id="airtime-phone" inputMode="tel" value={airtimePhone} onChange={(e) => setAirtimePhone(e.target.value.replace(/[^\d+]/g, ""))} />
          </label>
        </>
      )}
      <AmountField id="pay-amount" currency={wallet.currency} value={amount} onChange={setAmount} />
      {error && <Banner tone="error">{error}</Banner>}
      <button disabled={!amountMinor} onClick={review}>
        Review
      </button>
    </div>
  );
}
