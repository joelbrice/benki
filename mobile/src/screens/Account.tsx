import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { parseMajorToMinor, TIER_LIMITS, type Dispute, type Locale, type SavingsVault, type UserTransaction } from "@benki/shared";
import {
  AmountField,
  Badge,
  Banner,
  Card,
  Checkbox,
  EmptyState,
  Field,
  GhostButton,
  LanguagePicker,
  Meter,
  Muted,
  PinField,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  SubCard,
  Summary,
  Title,
  TxRow,
  useAction,
} from "../components/ui";
import { useI18n } from "../i18n";
import type { Session } from "../session";
import { colors } from "../theme/colors";
import { useIntent } from "./flow";

export function Savings({ session }: { session: Session }) {
  const { t, money } = useI18n();
  const { api, wallet, user } = session;
  const [vaults, setVaults] = useState<SavingsVault[]>([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const { busy, error, run } = useAction();
  const fmt = (n: number) => money(n, wallet.currency);
  const load = useCallback(() => api.vaults().then((r) => setVaults(r.vaults), () => undefined), [api]);
  useEffect(() => {
    void load();
  }, [load]);
  const { setIntent, screen } = useIntent(session, () => {
    setAmounts({});
    void load();
  });
  if (screen) return screen;

  if (user.kycTier === "TIER_0") {
    return (
      <>
        <ScreenHeader title={t("savings.title")} subtitle={t("savings.intro")} />
        <Banner tone="warn">{t("err.tierRequired")}</Banner>
      </>
    );
  }

  const move = (v: SavingsVault, direction: "deposit" | "withdraw") => {
    const amountMinor = parseMajorToMinor(amounts[v.vaultId] ?? "", wallet.currency);
    if (!amountMinor) return;
    setIntent({
      title: direction === "deposit" ? t("savings.saveTo", { name: v.name }) : t("savings.withdrawFrom", { name: v.name }),
      rows: [[t("common.amount"), fmt(amountMinor)]],
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
      <ScreenHeader title={t("savings.title")} subtitle={t("savings.intro")} />
      {vaults.length === 0 && <EmptyState icon="target" text={t("savings.empty")} />}
      {vaults.map((v) => (
        <Card key={v.vaultId}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Title>{v.name}</Title>
            <Badge label={`${Math.min(100, Math.round((v.balanceMinor / Math.max(1, v.targetMinor)) * 100))}%`} tone="neutral" />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{fmt(v.balanceMinor)}</Text>
          <Meter used={v.balanceMinor} total={v.targetMinor} />
          <Muted>{t("savings.progress", { saved: fmt(v.balanceMinor), target: fmt(v.targetMinor) })}</Muted>
          <AmountField currency={wallet.currency} value={amounts[v.vaultId] ?? ""} onChange={(val) => setAmounts({ ...amounts, [v.vaultId]: val })} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton title={t("savings.add")} onPress={() => move(v, "deposit")} />
            </View>
            <View style={{ flex: 1 }}>
              <SecondaryButton title={t("savings.withdraw")} onPress={() => move(v, "withdraw")} />
            </View>
          </View>
        </Card>
      ))}
      <Card>
        <Title>{t("savings.new")}</Title>
        <Field label={t("savings.name")} value={name} maxLength={40} onChangeText={setName} />
        <AmountField label={t("savings.target")} currency={wallet.currency} value={target} onChange={setTarget} />
        {error && <Banner tone="error">{error}</Banner>}
        <PrimaryButton
          title={t("savings.create")}
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

export function Activity({ session }: { session: Session }) {
  const { t, money } = useI18n();
  const { api, wallet } = session;
  const [transactions, setTransactions] = useState<UserTransaction[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const load = useCallback(async () => {
    const [tx, d] = await Promise.all([api.transactions(wallet.walletId), api.disputes()]);
    setTransactions(tx.transactions);
    setDisputes(d.disputes);
  }, [api, wallet.walletId]);
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load, wallet.ledgerBalanceMinor]);

  return (
    <>
      <ScreenHeader title={t("activity.title")} />
      {notice && <Banner tone="success">{notice}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      <Card>
        {transactions.length === 0 ? (
          <EmptyState icon="clock" text={t("activity.empty")} />
        ) : (
          transactions.map((tx) => {
            const dispute = disputes.find((d) => d.transactionId === tx.id);
            const open = expanded === tx.id;
            return (
              <Pressable key={tx.id} onPress={() => setExpanded(open ? null : tx.id)}>
                <TxRow tx={tx}>
                  {open && (
                    <SubCard>
                      {tx.feeMinor > 0 && <Muted>{t("activity.feeLine", { amount: money(tx.feeMinor, tx.currency) })}</Muted>}
                      {tx.receiveAmountMinor !== null && tx.receiveCurrency && (
                        <Muted>
                          {t(tx.type === "FX_CONVERSION" ? "activity.youGot" : "activity.recipientGot", { amount: money(tx.receiveAmountMinor, tx.receiveCurrency) })}
                        </Muted>
                      )}
                      {tx.note ? <Muted>“{tx.note}”</Muted> : null}
                      {tx.token && <Text style={{ fontFamily: "monospace", color: colors.text }}>{t("activity.token", { token: tx.token })}</Text>}
                      <Text style={{ fontFamily: "monospace", fontSize: 11, color: colors.subtext }}>{tx.id}</Text>
                      {dispute && (
                        <Muted>
                          {t("activity.dispute")}: {t(`dispute.${dispute.status}`)} {dispute.resolution ?? ""}
                        </Muted>
                      )}
                      {tx.disputable && !dispute && disputing !== tx.id && <GhostButton title={t("activity.report")} onPress={() => setDisputing(tx.id)} />}
                      {disputing === tx.id && (
                        <>
                          <Field label={t("activity.whatWrong")} value={reason} onChangeText={setReason} multiline maxLength={500} />
                          <PrimaryButton
                            title={t("activity.submit")}
                            disabled={busy || reason.trim().length < 10}
                            onPress={() =>
                              run(async () => {
                                await api.openDispute(tx.id, reason);
                                setDisputing(null);
                                setReason("");
                                setNotice(t("activity.received"));
                                await load();
                              })
                            }
                          />
                        </>
                      )}
                    </SubCard>
                  )}
                </TxRow>
              </Pressable>
            );
          })
        )}
      </Card>
    </>
  );
}

export function Profile({ session, onLogout, onLanguage }: { session: Session; onLogout: () => void; onLanguage: (l: Locale) => void }) {
  const { t, money } = useI18n();
  const { api, user, wallet, country } = session;
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
  const fmt = (n: number) => money(n, wallet.currency);

  return (
    <>
      <ScreenHeader title={t("profile.title")} subtitle={`${user.fullName ?? user.phoneNumber} · ${user.phoneNumber}`} />
      {message && <Banner tone="success">{message}</Banner>}
      <Card>
        <Title>{t("profile.language")}</Title>
        <Muted>{t("profile.languageHint")}</Muted>
        <LanguagePicker countryCode={country.code} onChange={onLanguage} />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Title>{t("profile.identity")}</Title>
          <Badge label={t(`tier.${user.kycTier}`)} />
        </View>
        {user.fullName && (
          <Summary
            rows={[
              [t("profile.name"), user.fullName],
              [t("profile.dob"), user.dateOfBirth ?? ""],
              [t("profile.nationalId"), user.nationalIdMasked ?? ""],
            ]}
          />
        )}
        {user.kycReviewPending && <Banner tone="warn">{t("profile.pending")}</Banner>}
        {user.kycTier === "TIER_0" && !user.kycReviewPending && user.status === "ACTIVE" && (
          <SubCard>
            <Title>{t("profile.tier1")}</Title>
            <Field label={t("profile.fullName")} value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <Field label={`${t("profile.dob")} (YYYY-MM-DD)`} value={dob} onChangeText={setDob} placeholder="1990-05-17" />
            <Field label={t("profile.idNumber")} value={nationalId} onChangeText={setNationalId} autoCapitalize="characters" />
            <Muted>{t("profile.privacy")}</Muted>
            {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
            <PrimaryButton
              title={t("profile.verify")}
              disabled={kyc.busy || !fullName || !dob || !nationalId}
              onPress={() =>
                kyc.run(async () => {
                  const res = await api.kycTier1({ fullName, dateOfBirth: dob, nationalId });
                  setMessage(res.user.kycReviewPending ? t("profile.pending") : t("profile.tier1Done"));
                  await session.refresh();
                })
              }
            />
          </SubCard>
        )}
        {user.kycTier === "TIER_1" && (
          <SubCard>
            <Title>{t("profile.tier2")}</Title>
            <Checkbox label={t("profile.address")} checked={addressOk} onToggle={() => setAddressOk(!addressOk)} />
            <Checkbox label={t("profile.liveness")} checked={livenessOk} onToggle={() => setLivenessOk(!livenessOk)} />
            {kyc.error && <Banner tone="error">{kyc.error}</Banner>}
            <PrimaryButton
              title={t("profile.upgrade")}
              disabled={kyc.busy || !addressOk || !livenessOk}
              onPress={() =>
                kyc.run(async () => {
                  await api.kycTier2();
                  setMessage(t("profile.tier2Done"));
                  await session.refresh();
                })
              }
            />
          </SubCard>
        )}
        <Title>{t("profile.limitsTable")}</Title>
        {(["TIER_0", "TIER_1", "TIER_2"] as const).map((tier) => {
          const l = TIER_LIMITS[country.code][tier];
          const current = tier === user.kycTier;
          return (
            <View key={tier} style={{ padding: 12, borderRadius: 14, backgroundColor: current ? colors.primarySoft : colors.surface2, gap: 6 }}>
              <Text style={{ fontWeight: "800", color: current ? colors.primary : colors.text }}>{t(`tier.${tier}`)}</Text>
              <Summary
                rows={[
                  [t("profile.colPerPayment"), fmt(l.perTransactionMinor)],
                  [t("profile.colDaily"), fmt(l.dailyMinor)],
                  [t("profile.colMonthly"), fmt(l.monthlyMinor)],
                  [t("profile.colHoldings"), fmt(l.maxBalanceMinor)],
                ]}
              />
            </View>
          );
        })}
      </Card>

      <Card>
        <Title>{t("profile.security")}</Title>
        <PinField label={t("profile.currentPin")} value={currentPin} onChange={setCurrentPin} />
        <PinField label={t("profile.newPin")} value={newPin} onChange={setNewPin} />
        {pin.error && <Banner tone="error">{pin.error}</Banner>}
        <SecondaryButton
          title={t("profile.changePin")}
          disabled={pin.busy || currentPin.length < 4 || newPin.length < 4}
          onPress={() =>
            pin.run(async () => {
              await api.changePin(currentPin, newPin);
              setCurrentPin("");
              setNewPin("");
              setMessage(t("profile.pinChanged"));
            })
          }
        />
        <Muted>{t("profile.signedIn", { phone: user.phoneNumber })}</Muted>
        <GhostButton title={t("nav.signOut")} icon="log-out" onPress={onLogout} />
      </Card>
    </>
  );
}
