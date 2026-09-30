import { randomUUID } from "crypto";
import {
  COUNTRY_BY_CODE,
  transferLimitMinor,
  type InternalTransferResponse,
  type MobileMoneyTransferResponse,
  type UserProfile,
  type WalletAccount,
  type WalletActionResponse,
  type WalletTransaction,
} from "@benki/shared";
import { appendTransaction, wallets } from "./store";
import { badRequest, complianceBlock, insufficientFunds } from "./errors";

/**
 * Mirrors app/src/main/java/com/example/benki/domain/WalletEngine.kt, extended
 * to double-entry internal transfers between two wallets per
 * docs/LEDGER_RECONCILIATION_SPEC.md (every transfer posts a debit on the
 * source wallet and a matching credit on the destination wallet), and to the
 * per-country rails (agents, mobile money, airtime) in
 * docs/COUNTRY_COMPLIANCE_MATRIX.md.
 */

export function currencyForCountry(countryCode: string): string {
  const country = COUNTRY_BY_CODE[countryCode];
  if (!country) throw badRequest(`Unsupported country ${countryCode}`);
  return country.currency;
}

export function requireAgent(countryCode: string, agentId: string) {
  const country = COUNTRY_BY_CODE[countryCode];
  const agent = country?.agents.find((a) => a.id === agentId);
  if (!agent) throw badRequest(`Unknown agent ${agentId} for ${countryCode}`);
  return agent;
}

export function requireMobileMoneyProvider(countryCode: string, providerId: string) {
  const country = COUNTRY_BY_CODE[countryCode];
  const provider = country?.mobileMoneyProviders.find((p) => p.id === providerId);
  if (!provider) throw badRequest(`Unknown mobile money provider ${providerId} for ${countryCode}`);
  return provider;
}

export function createWallet(ownerUserId: string, currency: string): WalletAccount {
  const wallet: WalletAccount = {
    walletId: `WALLET-${randomUUID()}`,
    ownerUserId,
    currency,
    availableBalanceMinor: 0,
    pendingBalanceMinor: 0,
    reservedBalanceMinor: 0,
  };
  wallets.set(wallet.walletId, wallet);
  return wallet;
}

function mutateBalance(walletId: string, deltaMinor: number): WalletAccount {
  const wallet = wallets.get(walletId);
  if (!wallet) throw badRequest(`Unknown wallet ${walletId}`);
  if (wallet.availableBalanceMinor + deltaMinor < 0) throw insufficientFunds();
  const updated: WalletAccount = {
    ...wallet,
    availableBalanceMinor: wallet.availableBalanceMinor + deltaMinor,
  };
  wallets.set(walletId, updated);
  return updated;
}

function checkTierLimit(sender: UserProfile, amountMinor: number) {
  const limit = transferLimitMinor(sender.countryCode, sender.kycTier);
  if (amountMinor > limit) {
    throw complianceBlock(
      `Transfer exceeds ${sender.kycTier} limit for ${sender.countryCode} — upgrade KYC tier to raise it`,
    );
  }
}

export function cashIn(walletId: string, amountMinor: number, agentName: string): WalletTransaction {
  const wallet = mutateBalance(walletId, amountMinor);
  const tx: WalletTransaction = {
    reference: `TX-${randomUUID()}`,
    walletId: wallet.walletId,
    type: "CASH_IN",
    amountMinor,
    counterparty: agentName,
    note: "Cash-in via agent",
    createdAt: new Date().toISOString(),
  };
  appendTransaction(tx);
  return tx;
}

export function cashOut(
  wallet: WalletAccount,
  sender: UserProfile,
  amountMinor: number,
  agentName: string,
): WalletActionResponse {
  checkTierLimit(sender, amountMinor);
  const updated = mutateBalance(wallet.walletId, -amountMinor);
  const tx: WalletTransaction = {
    reference: `TX-${randomUUID()}`,
    walletId: wallet.walletId,
    type: "CASH_OUT",
    amountMinor,
    counterparty: agentName,
    note: "Cash-out via agent",
    createdAt: new Date().toISOString(),
  };
  appendTransaction(tx);
  return { wallet: updated, transaction: tx };
}

export function airtimeTopUp(
  wallet: WalletAccount,
  sender: UserProfile,
  amountMinor: number,
  providerLabel: string,
  phoneNumber: string,
): WalletActionResponse {
  checkTierLimit(sender, amountMinor);
  const updated = mutateBalance(wallet.walletId, -amountMinor);
  const tx: WalletTransaction = {
    reference: `TX-${randomUUID()}`,
    walletId: wallet.walletId,
    type: "AIRTIME_TOPUP",
    amountMinor,
    counterparty: providerLabel,
    note: `Airtime top-up for ${phoneNumber}`,
    createdAt: new Date().toISOString(),
  };
  appendTransaction(tx);
  return { wallet: updated, transaction: tx };
}

export function transferInternal(
  sender: UserProfile,
  recipient: UserProfile,
  amountMinor: number,
  currency: string,
  note: string | undefined,
): InternalTransferResponse {
  if (!sender.walletId) throw insufficientFunds("Sender has no wallet");
  if (!recipient.walletId) throw insufficientFunds("Recipient has no wallet");

  const sourceWallet = wallets.get(sender.walletId);
  const destinationWallet = wallets.get(recipient.walletId);
  if (!sourceWallet || !destinationWallet) throw insufficientFunds("Wallet not found");

  if (sourceWallet.currency !== currency || destinationWallet.currency !== currency) {
    throw complianceBlock("Currency mismatch between wallets and transfer request");
  }

  checkTierLimit(sender, amountMinor);

  const updatedSource = mutateBalance(sourceWallet.walletId, -amountMinor);
  mutateBalance(destinationWallet.walletId, amountMinor);

  const transferId = `TRANSFER-${randomUUID()}`;
  const createdAt = new Date().toISOString();

  const debitTx: WalletTransaction = {
    reference: transferId,
    walletId: sourceWallet.walletId,
    type: "TRANSFER_OUT",
    amountMinor,
    counterparty: recipient.phoneNumber,
    note: note ?? "Internal wallet transfer",
    createdAt,
  };
  const creditTx: WalletTransaction = {
    reference: transferId,
    walletId: destinationWallet.walletId,
    type: "TRANSFER_IN",
    amountMinor,
    counterparty: sender.phoneNumber,
    note: note ?? "Internal wallet transfer",
    createdAt,
  };
  appendTransaction(debitTx);
  appendTransaction(creditTx);

  return {
    transferId,
    status: "COMPLETED",
    wallet: updatedSource,
    transaction: debitTx,
  };
}

export function transferMobileMoney(
  sender: UserProfile,
  wallet: WalletAccount,
  providerLabel: string,
  destinationPhoneNumber: string,
  amountMinor: number,
  currency: string,
  note: string | undefined,
): MobileMoneyTransferResponse {
  if (wallet.currency !== currency) {
    throw complianceBlock("Currency mismatch between wallet and transfer request");
  }
  checkTierLimit(sender, amountMinor);
  const updated = mutateBalance(wallet.walletId, -amountMinor);

  const transferId = `MOMO-${randomUUID()}`;
  const tx: WalletTransaction = {
    reference: transferId,
    walletId: wallet.walletId,
    type: "MOBILE_MONEY_OUT",
    amountMinor,
    counterparty: `${providerLabel} · ${destinationPhoneNumber}`,
    note: note ?? "Mobile money payout",
    createdAt: new Date().toISOString(),
  };
  appendTransaction(tx);

  return { transferId, status: "COMPLETED", wallet: updated, transaction: tx };
}
