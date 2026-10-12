import { useState } from "react";
import {
  AFRICAN_COUNTRIES,
  banksFor,
  corridorPolicy,
  COUNTRY_BY_CODE,
  parseMajorToMinor,
  PURPOSE_CODES,
  tierAtLeast,
  type MessageKey,
  type NameEnquiryResponse,
  type PurposeCode,
} from "@benki/shared";
import { useI18n } from "../i18n";
import { AmountField, Banner, hintLabel, PageHeader, Segmented, useAction } from "../ui/common";
import { ConfirmPayment, type PaymentIntent } from "../ui/ConfirmPayment";
import type { Session } from "./session";

type Mode = "benki" | "momo" | "bank" | "abroad";

export function Send({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { api, country, wallet, user } = session;
  const [mode, setMode] = useState<Mode>(session.preset && ["benki", "momo", "bank", "abroad"].includes(session.preset) ? (session.preset as Mode) : "benki");
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [phone, setPhone] = useState(country.callingCode);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [providerId, setProviderId] = useState(country.mobileMoneyProviders[0].id);
  const otherCountries = AFRICAN_COUNTRIES.filter((c) => c.code !== country.code);
  const [destCountry, setDestCountry] = useState(otherCountries[0].code);
  const [purpose, setPurpose] = useState<PurposeCode>("FAMILY_SUPPORT");
  const banks = banksFor(country.code);
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolved, setResolved] = useState<NameEnquiryResponse | null>(null);
  const { busy, error, setError, run } = useAction();
  const countryName = (code: string) => t(`country.${code}` as MessageKey);

  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const reset = () => {
    setIntent(null);
    setAmount("");
    setNote("");
    setResolved(null);
    setAccountNumber("");
    void session.refresh();
  };

  if (intent) return <ConfirmPayment api={api} intent={intent} onDone={reset} onCancel={() => setIntent(null)} />;

  const amountRow = (): [string, string] => [t("common.amount"), money(amountMinor!, wallet.currency)];
  const noteRow = (): [string, string][] => (note ? [[t("common.note"), note]] : []);

  const review = () => {
    if (!amountMinor) return setError(t("common.invalidAmount"));
    setError(null);
    if (mode === "benki") {
      setIntent({
        title: t("send.toBenki"),
        rows: [[t("common.to"), phone], amountRow(), ...noteRow()],
        currency: wallet.currency,
        amountMinor,
        feeType: "P2P",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.p2p({ idempotencyKey, pin, destinationPhoneNumber: phone, amountMinor, note: note || undefined }),
      });
    } else if (mode === "momo") {
      const provider = country.mobileMoneyProviders.find((p) => p.id === providerId)!;
      setIntent({
        title: t("send.toProvider", { provider: provider.label }),
        rows: [[t("common.to"), `${provider.label} · ${phone}`], amountRow(), ...noteRow()],
        currency: wallet.currency,
        amountMinor,
        feeType: "MOBILE_MONEY_PAYOUT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.mobileMoney({ idempotencyKey, pin, providerId, destinationPhoneNumber: phone, amountMinor, note: note || undefined }),
      });
    } else if (mode === "bank") {
      if (!resolved) return setError(t("send.lookUpFirst"));
      const bank = banks.find((b) => b.id === resolved.bankId)!;
      setIntent({
        title: t("send.toBank", { bank: bank.name }),
        rows: [
          [t("send.accountName"), resolved.accountName],
          [t("send.bankName"), bank.name],
          [t("send.account"), resolved.accountNumber],
          amountRow(),
          ...noteRow(),
        ],
        currency: wallet.currency,
        amountMinor,
        feeType: "BANK_TRANSFER",
        requirePin: true,
        submit: (pin, idempotencyKey) =>
          api.bankTransfer({
            idempotencyKey,
            pin,
            bankId: resolved.bankId,
            accountNumber: resolved.accountNumber,
            accountName: resolved.accountName,
            amountMinor,
            note: note || undefined,
          }),
      });
    } else {
      void run(async () => {
        const quote = await api.fxQuote(destCountry, amountMinor);
        setIntent({
          title: t("send.toCountry", { country: countryName(destCountry) }),
          rows: [
            [t("common.to"), `${phone} (${countryName(destCountry)})`],
            [t("send.youSend"), money(quote.sendAmountMinor, quote.sendCurrency)],
            [t("common.fee"), money(quote.feeMinor, quote.sendCurrency)],
            [t("send.rate"), t("send.rateLine", { from: quote.sendCurrency, rate: String(quote.rate), to: quote.receiveCurrency })],
            [t("send.purpose"), t(`purpose.${purpose}`)],
            [t("send.lockedUntil"), date(quote.expiresAt, true)],
            [t("send.theyReceive"), money(quote.receiveAmountMinor, quote.receiveCurrency)],
            [t("common.total"), money(quote.totalDebitMinor, quote.sendCurrency)],
          ],
          currency: quote.sendCurrency,
          amountMinor,
          requirePin: true,
          submit: (pin, idempotencyKey) => api.crossBorder({ idempotencyKey, pin, quoteId: quote.quoteId, destinationPhoneNumber: phone, purposeCode: purpose }),
        });
      });
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setPhone(m === "abroad" ? COUNTRY_BY_CODE[destCountry].callingCode : country.callingCode);
  };
  const needsTier = (mode === "abroad" || mode === "bank") && user.kycTier === "TIER_0";
  const corridor = corridorPolicy(country.code, destCountry);
  const corridorBlocked = mode === "abroad" && !needsTier && !tierAtLeast(user.kycTier, corridor.minTier);
  const selectedBank = banks.find((b) => b.id === bankId);

  return (
    <div className="stack">
      <PageHeader title={t("send.title")} />
      <div className="card">
        <Segmented
          value={mode}
          onChange={switchMode}
          options={[
            { id: "benki", label: t("send.benki"), icon: "send" },
            { id: "momo", label: t("send.momo"), icon: "phone" },
            { id: "bank", label: t("send.bank"), icon: "bank" },
            { id: "abroad", label: t("send.abroad"), icon: "plane" },
          ]}
        />

        {needsTier ? (
          <Banner tone="warn">
            {t(mode === "bank" ? "send.tierBank" : "send.tierAbroad")}{" "}
            <button className="link" onClick={() => session.go("profile")}>
              {t("home.verifyNow")}
            </button>
          </Banner>
        ) : mode === "bank" ? (
          <>
            <label htmlFor="bank-id">
              {t("send.bankName")}
              <select
                id="bank-id"
                value={bankId}
                onChange={(e) => {
                  setBankId(e.target.value);
                  setResolved(null);
                }}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="bank-account">
              {selectedBank ? hintLabel(selectedBank.accountNumberHint, t) : t("hint.account")}
              <input
                id="bank-account"
                autoComplete="off"
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.toUpperCase());
                  setResolved(null);
                }}
              />
            </label>
            {resolved ? (
              <>
                <Banner tone="success">
                  {t("send.holder", { name: resolved.accountName })} {t("send.checkPayee")}
                </Banner>
                <AmountField id="bank-amount" currency={wallet.currency} value={amount} onChange={setAmount} />
                <label htmlFor="bank-note">
                  {t("common.referenceOptional")}
                  <input id="bank-note" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <button className="block" disabled={busy || !amountMinor} onClick={review}>
                  {t("common.review")}
                </button>
              </>
            ) : (
              <button className="secondary block" disabled={busy || accountNumber.trim().length < 6} onClick={() => run(async () => setResolved(await api.nameEnquiry(bankId, accountNumber)))}>
                {busy ? t("common.checking") : t("send.lookUp")}
              </button>
            )}
          </>
        ) : (
          <>
            {mode === "momo" && (
              <label htmlFor="momo-provider">
                {t("send.provider")}
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
              <div className="field-row">
                <label htmlFor="dest-country">
                  {t("send.destination")}
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
                        {c.flag} {countryName(c.code)} ({c.currency})
                      </option>
                    ))}
                  </select>
                </label>
                {corridor.atPar && <p className="muted small full-row">{t("send.atPar")}</p>}
                <label htmlFor="purpose">
                  {t("send.purpose")}
                  <select id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value as PurposeCode)}>
                    {PURPOSE_CODES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t(`purpose.${p.id}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            <label htmlFor="send-phone">
              {t("send.recipientPhone")}
              <input id="send-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} />
            </label>
            <AmountField id="send-amount" currency={wallet.currency} value={amount} onChange={setAmount} label={mode === "abroad" ? t("send.youSend") : undefined} />
            {mode !== "abroad" && (
              <label htmlFor="send-note">
                {t("common.noteOptional")}
                <input id="send-note" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            )}
            {corridorBlocked && (
              <Banner tone="warn">
                {t("err.cemacOutbound")}{" "}
                <button className="link" onClick={() => session.go("profile")}>
                  {t("home.verifyNow")}
                </button>
              </Banner>
            )}
            <button className="block" disabled={busy || !amountMinor || phone.length < 9 || corridorBlocked} onClick={review}>
              {mode === "abroad" ? t("send.getQuote") : t("common.review")}
            </button>
          </>
        )}
        {error && <Banner tone="error">{error}</Banner>}
      </div>
    </div>
  );
}
