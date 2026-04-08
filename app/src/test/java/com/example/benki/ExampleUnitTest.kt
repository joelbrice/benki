package com.example.benki

import com.example.benki.domain.TransferResult
import com.example.benki.domain.WalletEngine
import org.junit.Test
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

/**
 * Example local unit test, which will execute on the development machine (host).
 *
 * See [testing documentation](http://d.android.com/tools/testing).
 */
class ExampleUnitTest {
    @Test
    fun transfer_deducts_balance_when_funds_are_available() {
        val wallet = WalletEngine.createWallet(currency = "XOF")
        val (funded, _) = WalletEngine.cashIn(wallet, 10_000)
        val result = WalletEngine.transferInternal(funded, "Merchant", 2_500)

        assertTrue(result is TransferResult.Success)
        val success = result as TransferResult.Success
        assertEquals(7_500, success.wallet.availableBalanceMinor)
    }

    @Test
    fun transfer_fails_when_funds_are_insufficient() {
        val wallet = WalletEngine.createWallet(currency = "XOF")
        val result = WalletEngine.transferInternal(wallet, "Merchant", 1_000)

        assertTrue(result is TransferResult.Failure)
    }
}
