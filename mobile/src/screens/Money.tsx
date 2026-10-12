import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  AFRICAN_COUNTRIES,
  banksFor,
  COUNTRY_BY_CODE,
  parseMajorToMinor,
  PURPOSE_CODES,
  type MessageKey,
  type NameEnquiryResponse,
  type PurposeCode,
} from "@benki/shared";
import { AmountField, Banner, Card, ChipSelect, Field, Icon, LinkButton, Muted, PrimaryButton, ScreenHeader, SecondaryButton, Segmented, useAction } from "../components/ui";
import { useI18n, type I18n } from "../i18n";
import type { Session } from "../session";
import { colors } from "../theme/colors";
import { useIntent } from "./flow";

/** Translates the account-number hints that come from the provider catalog. */
export function hintLabel(hint: string, t: I18n["t"]): string {
  if (hint === "11-digit meter number") return t("hint.meter");
  if (hint === "Account number") return t("hint.account");
  if (hint === "Smartcard number") return t("hint.smartcard");
  if (hint === "Student reference") return t("hint.student");
  if (hint === "10-digit NUBAN") return t("hint.nuban");
  if (hint === "Account number (RIB)") return t("hint.rib");
  const range = hint.match(/^(\d+–\d+) digit account number$/);
  return range ? t("hint.digits", { range: range[1] }) : hint;
}

type SendMode = "benki" | "momo" | "bank" | "abroad";

export function Send({ session }: { session: Session }) {
  const { t, money, date } = useI18n();
  const { api, country, wallet, user } = session;
  const [mode, setMode] = useState<SendMode>(session.preset && ["benki", "momo", "bank", "abroad"].includes(session.preset) ? (session.preset as SendMode) : "benki");
  const [phone, setPhone] = useState(country.callingCode);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [providerId, setProviderId] = useState(country.mobileMoneyProviders[0].id);
  const others = AFRICAN_COUNTRIES.filter((c) => c.code !== country.code);
  const [dest, setDest] = useState(others[0].code);
  const [purpose, setPurpose] = useState<PurposeCode>("FAMILY_SUPPORT");
  const banks = banksFor(country.code);
  const [bankId, setBankId] = useState(banks[0]?.id ?? "");
  const [bankAccount, setBankAccount] = useState("");
  const [resolved, setResolved] = useState<NameEnquiryResponse | null>(null);
  const { busy, error, setError, run } = useAction();
  const { setIntent, screen } = useIntent(session, () => {
    setAmount("");
    setNote("");
    setResolved(null);
    setBankAccount("");
  });
  if (screen) return screen;

  const countryName = (code: string) => t(`country.${code}` as MessageKey);
  const amountMinor = parseMajorToMinor(amount, wallet.currency);
  const amountRow = (): [string, string] => [t("common.amount"), money(amountMinor!, wallet.currency)];
  const noteRows = (): [string, string][] => (note ? [[t("common.note"), note]] : []);

  const review = () => {
    if (!amountMinor) return setError(t("common.invalidAmount"));
    setError(null);
    if (mode === "benki") {
      setIntent({
        title: t("send.toBenki"),
        rows: [[t("common.to"), phone], amountRow(), ...noteRows()],
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
        rows: [[t("common.to"), `${provider.label} · ${phone}`], amountRow()],
        currency: wallet.currency,
        amountMinor,
        feeType: "MOBILE_MONEY_PAYOUT",
        requirePin: true,
        submit: (pin, idempotencyKey) => api.mobileMoney({ idempotencyKey, pin, providerId, destinationPhoneNumber: phone, amountMinor }),
      });
    } else if (mode === "bank") {
      if (!resolved) return setError(t("send.lookUpFirst"));
      const bank = banks.find((b) => b.id === resolved.bankId)!;
      setIntent({
        title: t("send.toBank", { bank: bank.name }),
        rows: [[t("send.accountName"), resolved.accountName], [t("send.bankName"), bank.name], [t("send.account"), resolved.accountNumber], amountRow()],
        currency: wallet.currency,
        amountMinor,
        feeType: "BANK_TRANSFER",
        requirePin: true,
        submit: (pin, idempotencyKey) =>
          api.bankTransfer({ idempotencyKey, pin, bankId: resolved.bankId, accountNumber: resolved.accountNumber, accountName: resolved.accountName, amountMinor }),
      });
    } else {
      void run(async () => {
        const q = await api.fxQuote(dest, amountMinor);
        setIntent({
          title: t("send.toCountry", { country: countryName(dest) }),
          rows: [
            [t("common.to"), phone],
            [t("send.youSend"), money(q.sendAmountMinor, q.sendCurrency)],
            [t("common.fee"), money(q.feeMinor, q.sendCurrency)],
            [t("send.rate"), t("send.rateLine", { from: q.sendCurrency, rate: String(q.rate), to: q.receiveCurrency })],
            [t("send.purpose"), t(`purpose.${purpose}`)],
            [t("send.lockedUntil"), date(q.expiresAt, true)],
            [t("send.theyReceive"), money(q.receiveAmountMinor, q.receiveCurrency)],
            [t("common.total"), money(q.totalDebitMinor, q.sendCurrency)],
          ],
          currency: q.sendCurrency,
          amountMinor,
          requirePin: true,
          submit: (pin, idempotencyKey) => api.crossBorder({ idempotencyKey, pin, quoteId: q.quoteId, destinationPhoneNumber: phone, purposeCode: purpose }),
        });
      });
    }
  };

  const needsTier = (mode === "abroad" || mode === "bank") && user.kycTier === "TIER_0";
  const selectedBank = banks.find((b) => b.id === bankId);

  return (
    <>
      <ScreenHeader title={t("send.title")} />
      <Card>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
            setPhone(m === "abroad" ? COUNTRY_BY_CODE[dest].callingCode : country.callingCode);
          }}
          options={[
            { id: "benki", label: t("send.benki") },
            { id: "momo", label: t("send.momo") },
            { id: "bank", label: t("send.bank") },
            { id: "abroad", label: t("send.abroad") },
          ]}
        />
        {needsTier ? (
          <>
            <Banner tone="warn">{t(mode === "bank" ? "send.tierBank" : "send.tierAbroad")}</Banner>
            <LinkButton title={t("home.verifyNow")} onPress={() => session.go("profile")} />
          </>
        ) : mode === "bank" ? (
          <>
            <ChipSelect
              label={t("send.bankName")}
              value={bankId}
              onChange={(id) => {
                setBankId(id);
                setResolved(null);
              }}
              options={banks.map((b) => ({ id: b.id, label: b.name }))}
            />
            <Field
              label={selectedBank ? hintLabel(selectedBank.accountNumberHint, t) : t("hint.account")}
              value={bankAccount}
              autoCapitalize="characters"
              onChangeText={(v) => {
                setBankAccount(v.toUpperCase());
                setResolved(null);
              }}
            />
            {resolved ? (
              <>
                <Banner tone="success">
                  {t("send.holder", { name: resolved.accountName })} {t("send.checkPayee")}
                </Banner>
                <AmountField currency={wallet.currency} value={amount} onChange={setAmount} />
                <PrimaryButton title={t("common.review")} disabled={!amountMinor} onPress={review} />
              </>
            ) : (
              <SecondaryButton
                title={busy ? t("common.checking") : t("send.lookUp")}
                disabled={busy || bankAccount.trim().length < 6}
                onPress={() => run(async () => setResolved(await api.nameEnquiry(bankId, bankAccount)))}
              />
            )}
          </>
        ) : (
          <>
            {mode === "momo" && (
              <ChipSelect label={t("send.provider")} value={providerId} onChange={setProviderId} options={country.mobileMoneyProviders.map((p) => ({ id: p.id, label: p.label }))} />
            )}
            {mode === "abroad" && (
              <>
                <ChipSelect
                  label={t("send.destination")}
                  value={dest}
                  onChange={(c) => {
                    setDest(c);
                    setPhone(COUNTRY_BY_CODE[c].callingCode);
                  }}
                  options={others.map((c) => ({ id: c.code, label: `${c.flag} ${countryName(c.code)}` }))}
                />
                <ChipSelect label={t("send.purpose")} value={purpose} onChange={setPurpose} options={PURPOSE_CODES.map((p) => ({ id: p.id, label: t(`purpose.${p.id}`) }))} />
              </>
            )}
            <Field label={t("send.recipientPhone")} value={phone} onChangeText={(v) => setPhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
            <AmountField currency={wallet.currency} value={amount} onChange={setAmount} label={mode === "abroad" ? t("send.youSend") : undefined} />
            {mode === "benki" && <Field label={t("common.noteOptional")} value={note} maxLength={140} onChangeText={setNote} />}
            <PrimaryButton title={mode === "abroad" ? t("send.getQuote") : t("common.review")} disabled={busy || !amountMinor || phone.length < 9} onPress={review} />
          </>
        )}
        {error && <Banner tone="error">{error}</Banner>}
      </Card>
    </>
  );
}

type PayMode = "bills" | "merchant" | "airtime";

export function Pay({ session }: { session: Session }) {
  const { t, money } = useI18n();
  const { api, country, wallet, user } = session;
  const [mode, setMode] = useState<PayMode>(session.preset === "airtime" || session.preset === "merchant" ? session.preset : "bills");
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
  const billerLabel = (b: typeof biller) => `${t(`biller.${b.category}` as MessageKey)} — ${b.name}`;
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
      const merchant = country.merchants.find((m) => m.code === merchantCode);
      setIntent({
        title: t("pay.payMerchant"),
        rows: [[t("pay.merchant"), merchant ? merchant.name : merchantCode], amountRow],
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
    <>
      <ScreenHeader title={t("pay.title")} />
      <Card>
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { id: "bills", label: t("pay.bills"), icon: "file-text" },
            { id: "merchant", label: t("pay.merchant"), icon: "shopping-bag" },
            { id: "airtime", label: t("pay.airtime"), icon: "zap" },
          ]}
        />
        {mode === "bills" && (
          <>
            <ChipSelect label={t("pay.biller")} value={billerId} onChange={setBillerId} options={country.billers.map((b) => ({ id: b.id, label: billerLabel(b) }))} />
            <Field label={hintLabel(biller.accountNumberHint, t)} value={accountNumber} onChangeText={setAccountNumber} autoCapitalize="characters" />
            {biller.issuesToken && <Muted>{t("pay.tokenHint")}</Muted>}
          </>
        )}
        {mode === "merchant" && (
          <>
            <ChipSelect label={t("pay.nearby")} value={merchantCode} onChange={setMerchantCode} options={country.merchants.map((m) => ({ id: m.code, label: m.name }))} />
            <Field label={t("pay.merchantCode")} value={merchantCode} onChangeText={(v) => setMerchantCode(v.toUpperCase())} autoCapitalize="characters" />
          </>
        )}
        {mode === "airtime" && (
          <>
            <ChipSelect label={t("pay.network")} value={providerId} onChange={setProviderId} options={country.mobileMoneyProviders.map((p) => ({ id: p.id, label: p.label }))} />
            <Field label={t("common.phone")} value={airtimePhone} onChangeText={(v) => setAirtimePhone(v.replace(/[^\d+]/g, ""))} keyboardType="phone-pad" />
          </>
        )}
        <AmountField currency={wallet.currency} value={amount} onChange={setAmount} />
        {error && <Banner tone="error">{error}</Banner>}
        <PrimaryButton title={t("common.review")} disabled={!amountMinor} onPress={review} />
      </Card>
    </>
  );
}

export function Cash({ session }: { session: Session }) {
  const { t, money } = useI18n();
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
      title: direction === "in" ? t("cash.depositTitle") : t("cash.withdrawTitle"),
      rows: [
        [t("cash.agent"), `${agent.name}, ${agent.location}`],
        [t("common.amount"), money(amountMinor, wallet.currency)],
      ],
      currency: wallet.currency,
      amountMinor,
      feeType: direction === "in" ? "CASH_IN" : "CASH_OUT",
      requirePin: direction === "out",
      submit: (pin, idempotencyKey) =>
        direction === "in" ? api.cashIn(wallet.walletId, { idempotencyKey, agentId, amountMinor }) : api.cashOut(wallet.walletId, { idempotencyKey, pin, agentId, amountMinor }),
    });
  };

  return (
    <>
      <ScreenHeader title={t("cash.title")} subtitle={t("cash.intro")} />
      <Card>
        <Text style={{ fontWeight: "700", color: colors.text2, fontSize: 13 }}>{t("cash.agent")}</Text>
        {country.agents.map((a) => {
          const active = a.id === agentId;
          return (
            <Pressable
              key={a.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setAgentId(a.id)}
              style={{
                flexDirection: "row",
                gap: 12,
                alignItems: "center",
                padding: 12,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primarySoft : colors.surface2,
              }}
            >
              <Icon name="map-pin" size={18} color={active ? colors.primary : colors.subtext} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{a.name}</Text>
                <Muted>{a.location}</Muted>
              </View>
            </Pressable>
          );
        })}
        <AmountField currency={wallet.currency} value={amount} onChange={setAmount} />
        <PrimaryButton title={t("cash.deposit")} disabled={!amountMinor} onPress={() => start("in")} />
        <SecondaryButton title={t("cash.withdraw")} disabled={!amountMinor} onPress={() => start("out")} />
      </Card>
    </>
  );
}
