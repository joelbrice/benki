import { useState } from "react";
import { AFRICAN_COUNTRIES, COUNTRY_BY_CODE, formatAmount, parseMajorToMinor, PURPOSE_CODES, type PurposeCode } from "@benki/shared";
import { ConfirmPayment, type PaymentIntent } from "../components/ConfirmPayment";
import { AmountField, Banner, Card, ChipSelect, Field, Muted, PrimaryButton, SecondaryButton, Title, useAction } from "../components/ui";
import type { Session } from "../session";

function useIntent(session: Session, reset: () => void) {
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const screen = intent ? (
    <ConfirmPayment
      api={session.api}
      intent={intent}
      onDone={() => {
        setIntent(null);
        reset();
        void session.refresh();
      }}
      onCancel={() => setIntent(null)}
    />
  ) : null;
  return { setIntent, screen };
}

export function Send({ session }: { session: Session }) {
  const { api, country, wallet, user } = session;
  type Mode = "benki" | "momo" | "abroad";
  const [mode, setMode] = useState<Mode>("benki");
  const [phone, setPhone] = useState(country.callingCode);
  const [amount, setAmount] = useState("");
  const [providerId, setProviderId] = useState(country.mobileMoneyProviders[0].id);
  const others = AFRICAN_COUNTRIES.filter((c) => c.code !== country.code);
  const [dest, setDest] = useState(others[0].code);
  const [purpose, setPurpose] = useState<PurposeCode>("FAMILY_SUPPORT");
  const { busy, error, setError, run } = useAction();
  const { setIntent, screen } = useIntent(session, () => setAmount(""));
  if (screen) return screen;

  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const review = () => {
    if (!amountMinor) return setError("Enter a valid amount");
    if (mode === "benki") {
      setIntent({
        title: "Send to a Benki user",
        rows: [
          ["To", phone],
          ["Amount", formatAmount(amountMinor, wallet.currency)],
        ],
        currency: wallet.currency,
        amountMinor,
        feeType: "P2P",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.p2p({ idempotencyKey, pin, destinationPhoneNumber: phone, amountMinor }),
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
        submit: (pin, idempotencyKey) => api.mobileMoney({ idempotencyKey, pin, providerId, destinationPhoneNumber: phone, amountMinor }),
      });
    } else {
      run(async () => {
        const q = await api.fxQuote(dest, amountMinor);
        setIntent({
          title: `Send to ${COUNTRY_BY_CODE[dest].name}`,
          rows: [
            ["To", phone],
            ["You send", formatAmount(q.sendAmountMinor, q.sendCurrency)],
            ["Fee", formatAmount(q.feeMinor, q.sendCurrency)],
            ["Total", formatAmount(q.totalDebitMinor, q.sendCurrency)],
            ["Rate", `1 ${q.sendCurrency} = ${q.rate} ${q.receiveCurrency}`],
            ["They receive", formatAmount(q.receiveAmountMinor, q.receiveCurrency)],
          ],
          currency: q.sendCurrency,
          amountMinor,
          requirePin: true,
          submit: (pin, idempotencyKey) => api.crossBorder({ idempotencyKey, pin, quoteId: q.quoteId, destinationPhoneNumber: phone, purposeCode: purpose }),
        });
      });
    }
  };

  return (
    <Card>
      <Title>Send money</Title>
      <ChipSelect
        label="Send to"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setPhone(m === "abroad" ? COUNTRY_BY_CODE[dest].callingCode : country.callingCode);
        }}
        options={[
          { id: "benki", label: "Benki user" },
          { id: "momo", label: "Mobile money" },
          { id: "abroad", label: "Abroad" },
        ]}
      />
      {mode === "abroad" && user.kycTier === "TIER_0" ? (
        <Banner tone="warn">Verify your identity (Tier 1) in Profile to send money abroad.</Banner>
      ) : (
        <>
          {mode === "momo" && (
            <ChipSelect label="Provider" value={providerId} onChange={setProviderId} options={country.mobileMoneyProviders.map((p) => ({ id: p.id, label: p.label }))} />
          )}
          {mode === "abroad" && (
            <>
              <ChipSelect
                label="Destination"
                value={dest}
                onChange={(c) => {
                  setDest(c);
                  setPhone(COUNTRY_BY_CODE[c].callingCode);
                }}
                options={others.map((c) => ({ id: c.code, label: `${c.name} (${c.currency})` }))}
              />
              <ChipSelect label="Purpose" value={purpose} onChange={setPurpose} options={PURPOSE_CODES.map((p) => ({ id: p.id, label: p.label }))} />
            </>
          )}
          <Field label="Recipient's mobile number" value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
          <AmountField currency={wallet.currency} value={amount} onChange={setAmount} label={mode === "abroad" ? "You send" : "Amount"} />
          {error && <Banner tone="error">{error}</Banner>}
          <PrimaryButton title={mode === "abroad" ? "Get quote" : "Review"} disabled={busy || !amountMinor || phone.length < 9} onPress={review} />
        </>
      )}
    </Card>
  );
}

export function Pay({ session }: { session: Session }) {
  const { api, country, wallet, user } = session;
  type Mode = "bills" | "merchant" | "airtime";
  const [mode, setMode] = useState<Mode>("bills");
  const [amount, setAmount] = useState("");
  const [billerId, setBillerId] = useState(country.billers[0].id);
  const [accountNumber, setAccountNumber] = useState("");
  const [merchantCode, setMerchantCode] = useState(country.merchants[0].code);
  const [providerId, setProviderId] = useState(country.mobileMoneyProviders[0].id);
  const [airtimePhone, setAirtimePhone] = useState(user.phoneNumber);
  const { error, setError } = useAction();
  const { setIntent, screen } = useIntent(session, () => setAmount(""));
  if (screen) return screen;

  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const biller = country.billers.find((b) => b.id === billerId)!;
  const review = () => {
    if (!amountMinor) return setError("Enter a valid amount");
    const amountRow: [string, string] = ["Amount", formatAmount(amountMinor, wallet.currency)];
    if (mode === "bills") {
      if (!new RegExp(biller.accountNumberPattern).test(accountNumber.trim().toUpperCase())) return setError(`Enter a valid ${biller.accountNumberHint.toLowerCase()}`);
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
      const m = country.merchants.find((x) => x.code === merchantCode)!;
      setIntent({
        title: "Pay merchant",
        rows: [["Merchant", m.name], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "MERCHANT_PAYMENT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.merchant({ idempotencyKey, pin, merchantCode, amountMinor }),
      });
    } else {
      setIntent({
        title: "Buy airtime",
        rows: [["Phone", airtimePhone], amountRow],
        currency: wallet.currency,
        amountMinor,
        feeType: "AIRTIME",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.airtime(wallet.walletId, { idempotencyKey, pin, providerId, phoneNumber: airtimePhone, amountMinor }),
      });
    }
  };

  return (
    <Card>
      <Title>Pay</Title>
      <ChipSelect
        label="Pay for"
        value={mode}
        onChange={setMode}
        options={[
          { id: "bills", label: "Bills" },
          { id: "merchant", label: "Merchant" },
          { id: "airtime", label: "Airtime" },
        ]}
      />
      {mode === "bills" && (
        <>
          <ChipSelect label="Biller" value={billerId} onChange={setBillerId} options={country.billers.map((b) => ({ id: b.id, label: b.name }))} />
          <Field label={biller.accountNumberHint} value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" />
        </>
      )}
      {mode === "merchant" && (
        <ChipSelect label="Merchant" value={merchantCode} onChange={setMerchantCode} options={country.merchants.map((m) => ({ id: m.code, label: m.name }))} />
      )}
      {mode === "airtime" && (
        <>
          <ChipSelect label="Network" value={providerId} onChange={setProviderId} options={country.mobileMoneyProviders.map((p) => ({ id: p.id, label: p.label }))} />
          <Field label="Phone number" value={airtimePhone} onChangeText={(v) => setAirtimePhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
        </>
      )}
      <AmountField currency={wallet.currency} value={amount} onChange={setAmount} />
      {error && <Banner tone="error">{error}</Banner>}
      <PrimaryButton title="Review" disabled={!amountMinor} onPress={review} />
    </Card>
  );
}

export function Cash({ session }: { session: Session }) {
  const { api, country, wallet } = session;
  const [agentId, setAgentId] = useState(country.agents[0].id);
  const [amount, setAmount] = useState("");
  const { setIntent, screen } = useIntent(session, () => setAmount(""));
  if (screen) return screen;

  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const agent = country.agents.find((a) => a.id === agentId)!;
  const start = (direction: "in" | "out") => {
    if (!amountMinor) return;
    setIntent({
      title: direction === "in" ? "Deposit cash" : "Withdraw cash",
      rows: [
        ["Agent", `${agent.name}, ${agent.location}`],
        ["Amount", formatAmount(amountMinor, wallet.currency)],
      ],
      currency: wallet.currency,
      amountMinor,
      feeType: direction === "in" ? "CASH_IN" : "CASH_OUT",
      requirePin: direction === "out",
      submit: (pin, idempotencyKey) =>
        direction === "in"
          ? api.cashIn(wallet.walletId, { idempotencyKey, agentId, amountMinor })
          : api.cashOut(wallet.walletId, { idempotencyKey, pin, agentId, amountMinor }),
    });
  };

  return (
    <Card>
      <Title>Cash in / cash out</Title>
      <Muted>Visit a Benki agent. Deposits are free; withdrawals cost 0.5%.</Muted>
      <ChipSelect label="Agent" value={agentId} onChange={setAgentId} options={country.agents.map((a) => ({ id: a.id, label: `${a.name} — ${a.location}` }))} />
      <AmountField currency={wallet.currency} value={amount} onChange={setAmount} />
      <PrimaryButton title="Deposit" disabled={!amountMinor} onPress={() => start("in")} />
      <SecondaryButton title="Withdraw" disabled={!amountMinor} onPress={() => start("out")} />
    </Card>
  );
}
