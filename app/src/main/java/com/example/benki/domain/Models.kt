package com.example.benki.domain

enum class KycTier {
    TIER_0,
    TIER_1,
    TIER_2
}

enum class JourneyStep {
    ONBOARDING,
    KYC,
    WALLET,
    TRANSFER,
    HISTORY
}

enum class TransactionType {
    CASH_IN,
    TRANSFER_OUT,
    TRANSFER_IN
}

data class UserProfile(
    val phoneNumber: String,
    val country: String,
    val kycTier: KycTier
)

data class WalletAccount(
    val walletId: String,
    val currency: String,
    val availableBalanceMinor: Long,
    val pendingBalanceMinor: Long = 0,
    val reservedBalanceMinor: Long = 0
)

data class WalletTransaction(
    val reference: String,
    val type: TransactionType,
    val amountMinor: Long,
    val counterparty: String,
    val note: String
)
