package com.example.benki.domain

import java.util.UUID

object WalletEngine {

    fun createWallet(currency: String = "XOF"): WalletAccount {
        return WalletAccount(
            walletId = "WALLET-${UUID.randomUUID()}",
            currency = currency,
            availableBalanceMinor = 0
        )
    }

    fun cashIn(wallet: WalletAccount, amountMinor: Long): Pair<WalletAccount, WalletTransaction> {
        require(amountMinor > 0) { "Amount must be positive" }

        val updated = wallet.copy(
            availableBalanceMinor = wallet.availableBalanceMinor + amountMinor
        )
        val tx = WalletTransaction(
            reference = "TX-${UUID.randomUUID()}",
            type = TransactionType.CASH_IN,
            amountMinor = amountMinor,
            counterparty = "Agent",
            note = "Cash-in via rural agent"
        )
        return updated to tx
    }

    fun transferInternal(
        wallet: WalletAccount,
        recipient: String,
        amountMinor: Long
    ): TransferResult {
        require(recipient.isNotBlank()) { "Recipient is required" }
        require(amountMinor > 0) { "Amount must be positive" }

        if (wallet.availableBalanceMinor < amountMinor) {
            return TransferResult.Failure("Insufficient funds")
        }

        val updated = wallet.copy(
            availableBalanceMinor = wallet.availableBalanceMinor - amountMinor
        )
        val tx = WalletTransaction(
            reference = "TX-${UUID.randomUUID()}",
            type = TransactionType.TRANSFER_OUT,
            amountMinor = amountMinor,
            counterparty = recipient,
            note = "Internal wallet transfer"
        )
        return TransferResult.Success(updated, tx)
    }
}

sealed class TransferResult {
    data class Success(
        val wallet: WalletAccount,
        val transaction: WalletTransaction
    ) : TransferResult()

    data class Failure(val reason: String) : TransferResult()
}
