import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { formatAmount, parseMajorToMinor, type Dispute, type SavingsVault, type UserTransaction } from "@benki/shared";
import { ConfirmPayment, type PaymentIntent } from "../components/ConfirmPayment";
import {
  AmountField,
  Badge,
  Banner,
  Card,
  Checkbox,
  Field,
  GhostButton,
  Meter,
  Muted,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  SubCard,
  Summary,
  Title,
  TYPE_LABEL,
  useAction,
} from "../components/ui";
import type { Session } from "../session";

export function Savings({ session }: { session: Session }) {
  const { api, wallet } = session;
  const [vaults, setVaults] = useState<SavingsVault[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const { busy, error, run } = useAction();
  const fmt = (n: number) => formatAmount(n, wallet.currency);
  const load = useCallback(() => api.vaults().then((r) => setVaults(r.vaults), () => undefined), [api]);
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
          setAmounts({});
          void load();
          void session.refresh();
        }}
        onCancel={() => setIntent(null)}
      />
    );
  }

  const move = (v: SavingsVault, direction: "deposit" | "withdraw") => {
    const amountMinor = parseMajorToMinor(amounts[v.vaultId] ?? "", wallet.currency);
    if (!amountMinor) return;
    setIntent({
      title: direction === "deposit" ? `Save to ${v.name}` : `Withdraw from ${v.name}`,
      rows: [["Amount", fmt(amountMinor)]],
      currency: wallet.currency,
      amountMinor,
      requirePin: false,
      submit: (_pin, idempotencyKey) =>
        direction === "deposit" ? api.vaultDeposit(v.vaultId, { idempotencyKey, amountMinor }) : api.vaultWithdraw(v.vaultId, { idempotencyKey, amountMinor }),
    });
  };
  const targetMinor = parseMajorToMinor(target, wallet.currency);

  return (
    <>
      <Card>
        <Title>Savings vaults</Title>
        {vaults.length === 0 && <Muted>No vaults yet.</Muted>}
        {vaults.map((v) => (
          <SubCard key={v.vaultId}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700" }}>{v.name}</Text>
              <Muted>
                {fmt(v.balanceMinor)} / {fmt(v.targetMinor)}
              </Muted>
            </View>
            <Meter used={v.balanceMinor} total={v.targetMinor} />
            <AmountField currency={wallet.currency} value={amounts[v.vaultId] ?? ""} onChange={(val) => setAmounts({ ...amounts, [v.vaultId]: val })} />
            <PrimaryButton title="Add" onPress={() => move(v, "deposit")} />
            <SecondaryButton title="Withdraw" onPress={() => move(v, "withdraw")} />
          </SubCard>
        ))}
      </Card>
      <Card>
        <Title>New vault</Title>
        <Field label="Name" value={name} onChangeText={setName} maxLength={40} />
        <AmountField label="Target" currency={wallet.currency} value={target} onChange={setTarget} />
        {error && <Banner tone="error">{error}</Banner>}
        <PrimaryButton
          title="Create vault"
          disabled={busy || name.trim().length < 2 || !targetMinor}
          onPress={() =>
            run(async () => {
              await api.createVault(name, targetMinor!);
              setName("");
              setTarget("");
              await load();
            })
          }
        />
      </Card>
    </>
  );
}

export function History({ session }: { session: Session }) {
  const { api, wallet } = session;
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const load = useCallback(async () => {
    const [t, d] = await Promise.all([api.transactions(wallet.walletId), api.disputes()]);
    setTransactions(t.transactions);
    setDisputes(d.disputes);
  }, [api, wallet.walletId]);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load, wallet.ledgerBalanceMinor]);

  return (
    <Card>
      <Title>History</Title>
      <GhostButton title="Refresh" onPress={() => void load()} />
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      {transactions.length === 0 && <Muted>No transactions yet.</Muted>}
      {transactions.map((t) => {
        const dispute = disputes.find((d) => d.transactionId === t.id);
        return (
          <SubCard key={t.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700" }}>{TYPE_LABEL[t.type]}</Text>
              <Text style={{ fontWeight: "700", color: t.direction === "CREDIT" ? "#0f7a5c" : "#10241f" }}>
                {t.direction === "CREDIT" ? "+" : "−"}
                {formatAmount(t.amountMinor, t.currency)}
              </Text>
            </View>
            <Text>{t.counterparty}</Text>
            <StatusBadge status={t.status} />
            {t.feeMinor > 0 && <Muted>Fee {formatAmount(t.feeMinor, t.currency)}</Muted>}
            {t.token && <Text style={{ fontFamily: "monospace" }}>Token {t.token}</Text>}
            <Muted>{new Date(t.createdAt).toLocaleString()}</Muted>
            {dispute && <Muted>Dispute: {dispute.status.replace(/_/g, " ").toLowerCase()}</Muted>}
            {t.disputable && !dispute && disputing !== t.id && <GhostButton title="Report a problem" onPress={() => setDisputing(t.id)} />}
            {disputing === t.id && (
              <>
                <Field label="What went wrong?" value={reason} onChangeText={setReason} multiline maxLength={500} />
                <PrimaryButton
                  title="Submit dispute"
                  disabled={busy || reason.trim().length < 10}
                  onPress={() =>
                    run(async () => {
                      await api.openDispute(t.id, reason);
                      setDisputing(null);
                      setReason("");
                      setNotice("Dispute received. We'll update you within 10 working days.");
                      await load();
                    })
                  }
                />
              </>
            )}
          </SubCard>
        );
      })}
    </Card>
  );
}

export function Profile({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { api, user } = session;
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [addressOk, setAddressOk] = useState(false);
  const [livenessOk, setLivenessOk] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const kyc = useAction();
  const pin = useAction();
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Title>Identity verification</Title>
          <Badge label={user.kycTier.replace("_", " ")} />
        </View>
        {message && <Banner tone="success">{message}</Banner>}
        {user.fullName && (
          <Summary
            rows={[
              ["Name", user.fullName],
              ["Date of birth", user.dateOfBirth ?? ""],
              ["National ID", user.nationalIdMasked ?? ""],
            ]}
          />
        )}
        {user.kycReviewPending && <Banner tone="warn">Your details are being verified.</Banner>}
        {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
          <>
            <Field label="Full legal name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <Field label="Date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} keyboardType="numbers-and-punctuation" />
            <Field label="National ID number" value={nationalId} onChangeText={setNationalId} />
            <Muted>Your ID is encrypted and checked against official watchlists, as the law requires.</Muted>
            {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
            <PrimaryButton
              title="Verify"
              disabled={kyc.busy || !fullName || !dob || !nationalId}
              onPress={() =>
                kyc.run(async () => {
                  const res = await api.kycTier1({ fullName, dateOfBirth: dob, nationalId });
                  setMessage(res.message);
                  await session.refresh();
                })
              }
            />
          </>
        )}
        {user.kycTier === "TIER_1" && (
          <>
            <Checkbox label="I uploaded a proof of address" checked={addressOk} onToggle={() => setAddressOk(!addressOk)} />
            <Checkbox label="I completed the selfie liveness check" checked={livenessOk} onToggle={() => setLivenessOk(!livenessOk)} />
            {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
            <PrimaryButton
              title="Upgrade to Tier 2"
              disabled={kyc.busy || !addressOk || !livenessOk}
              onPress={() =>
                kyc.run(async () => {
                  const res = await api.kycTier2();
                  setMessage(res.message);
                  await session.refresh();
                })
              }
            />
          </>
        )}
      </Card>
      <Card>
        <Title>Security</Title>
        <Field label="Current PIN" value={currentPin} onChangeText={(v) => setCurrentPin(digits(v))} keyboardType="number-pad" secureTextEntry />
        <Field label="New PIN" value={newPin} onChangeText={(v) => setNewPin(digits(v))} keyboardType="number-pad" secureTextEntry />
        {pin.error && <Banner tone="error">{pin.error}</Banner>}
        <SecondaryButton
          title="Change PIN"
          disabled={pin.busy || currentPin.length < 4 || newPin.length < 4}
          onPress={() =>
            pin.run(async () => {
              await api.changePin(currentPin, newPin);
              setCurrentPin("");
              setNewPin("");
              setMessage("PIN changed.");
            })
          }
        />
        <Muted>Signed in as {user.phoneNumber}. Three wrong PINs lock payments for 30 minutes.</Muted>
        <GhostButton title="Sign out" onPress={onLogout} />
      </Card>
    </>
  );
}
