import { useState } from "react";
import { AFRICAN_COUNTRIES, COUNTRY_BY_CODE, formatAmount, parseMajorToMinor, PURPOSE_CODES, type PurposeCode } from "@benki/shared";
import { AmountField, Banner, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

type Mode = "benki" | "momo" | "abroad";

export function Send({ session }: { session: Session }) {
  const { api, country, wallet, user } = session;
  const [mode, setMode] = useState<Mode>("benki");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);

  const [phone, setPhone] = useState(country.callingCode);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [providerId, setProviderId] = useState(country.mobileMoneyProviders[0].id);
  const otherCountries = AFRICAN_COUNTRIES.filter((c) => c.code !== country.code);
  const [destCountry, setDestCountry] = useState(otherCountries[0].code);
  const [purpose, setPurpose] = useState<PurposeCode>("FAMILY_SUPPORT");
  const { busy, error, setError, run } = useAction();

  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const reset = () => {
    setIntent(null);
    setAmount("");
    setNote("");
    void session.refresh();
  };

  if (intent) return <ConfirmPayment api={api} intent={intent} onDone={reset} onCancel={() => setIntent(null)} />;

  const review = () => {
    if (!amountMinor) return setError("Enter a valid amount");
    if (mode === "benki") {
      setIntent({
        title: "Send to a Benki user",
        rows: [
          ["To", phone],
          ["Amount", formatAmount(amountMinor, wallet.currency)],
          ...(note ? ([["Note", note]] as [string, string][]) : []),
        ],
        currency: wallet.currency,
        amountMinor,
        feeType: "P2P",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.p2p({ idempotencyKey, pin, destinationPhoneNumber: phone, amountMinor, note: note || undefined }),
      });
    } else if (mode === "momo") {
      const provider = country.mobileMoneyProviders.find((p) => p.id === providerId)!;
      setIntent({
        title: `Send to ${provider.label}`,
        rows: [
          ["To", `${provider.label} · ${phone}`],
          ["Amount", formatAmount(amountMinor, wallet.currency)],
        ],
        currency: wallet.currency,
        amountMinor,
        feeType: "MOBILE_MONEY_PAYOUT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.mobileMoney({ idempotencyKey, pin, providerId, destinationPhoneNumber: phone, amountMinor, note: note || undefined }),
      });
    } else {
      run(async () => {
        const quote = await api.fxQuote(destCountry, amountMinor);
        const dest = COUNTRY_BY_CODE[destCountry];
        setIntent({
          title: `Send to ${dest.name}`,
          rows: [
            ["To", `${phone} (${dest.name})`],
            ["You send", formatAmount(quote.sendAmountMinor, quote.sendCurrency)],
            ["Fee", formatAmount(quote.feeMinor, quote.sendCurrency)],
            ["Total", formatAmount(quote.totalDebitMinor, quote.sendCurrency)],
            ["Rate", `1 ${quote.sendCurrency} = ${quote.rate} ${quote.receiveCurrency}`],
            ["They receive", formatAmount(quote.receiveAmountMinor, quote.receiveCurrency)],
            ["Purpose", PURPOSE_CODES.find((p) => p.id === purpose)!.label],
            ["Rate locked until", new Date(quote.expiresAt).toLocaleTimeString()],
          ],
          currency: quote.sendCurrency,
          amountMinor,
          requirePin: true,
          submit: (pin, idempotencyKey) =>
            api.crossBorder({ idempotencyKey, pin, quoteId: quote.quoteId, destinationPhoneNumber: phone, purposeCode: purpose }),
        });
      });
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setPhone(m === "abroad" ? COUNTRY_BY_CODE[destCountry].callingCode : country.callingCode);
  };

  return (
    <div className="card">
      <h2>Send money</h2>
      <div className="segmented" role="tablist">
        {(
          [
            ["benki", "Benki user"],
            ["momo", "Mobile money"],
            ["abroad", "Abroad"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "active" : undefined} onClick={() => switchMode(m)}>
            {label}
          </button>
        ))}
      </div>

      {mode === "abroad" && user.kycTier === "TIER_0" ? (
        <Banner tone="warn">Verify your identity (Tier 1) in Profile to send money abroad.</Banner>
      ) : (
        <>
          {mode === "momo" && (
            <label htmlFor="momo-provider">
              Provider
              <select id="momo-provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
                {country.mobileMoneyProviders.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === "abroad" && (
            <>
              <label htmlFor="dest-country">
                Destination
                <select
                  id="dest-country"
                  value={destCountry}
                  onChange={(e) => {
                    setDestCountry(e.target.value);
                    setPhone(COUNTRY_BY_CODE[e.target.value].callingCode);
                  }}
                >
                  {otherCountries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="purpose">
                Purpose
                <select id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as PurposeCode)}>
                  {PURPOSE_CODES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label htmlFor="send-phone">
            Recipient's mobile number
            <input id="send-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} />
          </label>
          <AmountField id="send-amount" currency={wallet.currency} value={amount} onChange={setAmount} label={mode === "abroad" ? "You send" : "Amount"} />
          {mode !== "abroad" && (
            <label htmlFor="send-note">
              Note (optional)
              <input id="send-note" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          )}
          {error && <Banner tone="error">{error}</Banner>}
          <button disabled={busy || !amountMinor || phone.length < 9} onClick={review}>
            {mode === "abroad" ? "Get quote" : "Review"}
          </button>
        </>
      )}
    </div>
  );
}
