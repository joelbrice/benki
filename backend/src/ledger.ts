import { randomUUID } from "crypto";
import {
  KYC_TIER_TRANSFER_LIMITS_MINOR,
  type InternalTransferResponse,
  type UserProfile,
  type WalletAccount,
  type WalletTransaction,
} from "@benki/shared";
import { appendTransaction, wallets } from "./store";
import { complianceBlock, insufficientFunds } from "./errors";

/**
 * Mirrors app/src/main/java/com/example/benki/domain/WalletEngine.kt, extended
 * to double-entry internal transfers between two wallets per
 * docs/LEDGER_RECONCILIATION_SPEC.md (every transfer posts a debit on the
 * source wallet and a matching credit on the destination wallet).
 */

export function createWallet(ownerUserId: string, currency = "XOF"): WalletAccount {
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

export function cashIn(walletId: string, amountMinor: number, counterparty = "Agent"): WalletTransaction {
  const wallet = wallets.get(walletId);
  if (!wallet) throw new Error(`Unknown wallet ${walletId}`);

  const updated: WalletAccount = {
    ...wallet,
    availableBalanceMinor: wallet.availableBalanceMinor + amountMinor,
  };
  wallets.set(walletId, updated);

  const tx: WalletTransaction = {
    reference: `TX-${randomUUID()}`,
    walletId,
    type: "CASH_IN",
    amountMinor,
    counterparty,
    note: "Cash-in via rural agent",
    createdAt: new Date().toISOString(),
  };
  appendTransaction(tx);
  return tx;
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

  const limit = KYC_TIER_TRANSFER_LIMITS_MINOR[sender.kycTier];
  if (amountMinor > limit) {
    throw complianceBlock(
      `Transfer exceeds ${sender.kycTier} limit of ${limit} minor units — upgrade KYC tier to raise it`,
    );
  }

  if (sourceWallet.availableBalanceMinor < amountMinor) {
    throw insufficientFunds();
  }

  const updatedSource: WalletAccount = {
    ...sourceWallet,
    availableBalanceMinor: sourceWallet.availableBalanceMinor - amountMinor,
  };
  const updatedDestination: WalletAccount = {
    ...destinationWallet,
    availableBalanceMinor: destinationWallet.availableBalanceMinor + amountMinor,
  };
  wallets.set(sourceWallet.walletId, updatedSource);
  wallets.set(destinationWallet.walletId, updatedDestination);

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
