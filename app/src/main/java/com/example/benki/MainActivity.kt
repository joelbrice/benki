package com.example.benki

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.Button
import androidx.compose.material.MaterialTheme
import androidx.compose.material.OutlinedTextField
import androidx.compose.material.Surface
import androidx.compose.material.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.example.benki.domain.JourneyStep
import com.example.benki.domain.KycTier
import com.example.benki.domain.TransferResult
import com.example.benki.domain.UserProfile
import com.example.benki.domain.WalletAccount
import com.example.benki.domain.WalletEngine
import com.example.benki.domain.WalletTransaction
import com.example.benki.ui.theme.BenkiTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            BenkiTheme {
                // A surface container using the 'background' color from the theme
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colors.background
                ) {
                    BankWithoutBordersApp()
                }
            }
        }
    }
}

@Composable
fun BankWithoutBordersApp() {
    var step by remember { mutableStateOf(JourneyStep.ONBOARDING) }
    var phoneNumber by remember { mutableStateOf("") }
    var country by remember { mutableStateOf("Senegal") }
    var kycTier by remember { mutableStateOf(KycTier.TIER_0) }
    var wallet by remember { mutableStateOf<WalletAccount?>(null) }
    var transferAmount by remember { mutableStateOf("500") }
    var recipient by remember { mutableStateOf("Village Merchant") }
    var statusMessage by remember { mutableStateOf("Low-bandwidth mode ready.") }
    val transactions = remember { mutableStateListOf<WalletTransaction>() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("Benki — Bank Without Borders", style = MaterialTheme.typography.h6)
        Text("Step: ${step.name}")
        Text("Focused for rural access, assisted onboarding, and interoperable transfers.")

        when (step) {
            JourneyStep.ONBOARDING -> {
                OutlinedTextField(
                    value = phoneNumber,
                    onValueChange = { phoneNumber = it },
                    label = { Text("Phone number") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = country,
                    onValueChange = { country = it },
                    label = { Text("Country") },
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    onClick = {
                        if (phoneNumber.isNotBlank() && country.isNotBlank()) {
                            statusMessage = "Onboarding complete. Proceed to KYC."
                            step = JourneyStep.KYC
                        } else {
                            statusMessage = "Phone number and country are required."
                        }
                    }
                ) {
                    Text("Complete Onboarding")
                }
            }

            JourneyStep.KYC -> {
                Text("Current KYC tier: ${kycTier.name}")
                Button(onClick = {
                    kycTier = KycTier.TIER_1
                    statusMessage = "Tier 1 KYC completed."
                }) {
                    Text("Upgrade to Tier 1")
                }
                Button(onClick = {
                    if (kycTier == KycTier.TIER_1 || kycTier == KycTier.TIER_2) {
                        statusMessage = "KYC validated. Proceed to wallet."
                        step = JourneyStep.WALLET
                    } else {
                        statusMessage = "Upgrade KYC before wallet creation."
                    }
                }) {
                    Text("Continue")
                }
            }

            JourneyStep.WALLET -> {
                val user = UserProfile(phoneNumber, country, kycTier)
                Text("User: ${user.phoneNumber} (${user.country})")
                Button(onClick = {
                    val created = WalletEngine.createWallet()
                    val (fundedWallet, cashInTx) = WalletEngine.cashIn(created, 50_000)
                    wallet = fundedWallet
                    transactions.add(cashInTx)
                    statusMessage = "Wallet created and funded with initial cash-in."
                }) {
                    Text("Create Wallet + Cash-in")
                }
                Button(onClick = {
                    if (wallet != null) {
                        step = JourneyStep.TRANSFER
                    } else {
                        statusMessage = "Create wallet first."
                    }
                }) {
                    Text("Continue")
                }
            }

            JourneyStep.TRANSFER -> {
                Text("Available balance: ${wallet?.availableBalanceMinor ?: 0} minor units")
                OutlinedTextField(
                    value = recipient,
                    onValueChange = { recipient = it },
                    label = { Text("Recipient") },
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = transferAmount,
                    onValueChange = { transferAmount = it },
                    label = { Text("Transfer amount (minor units)") },
                    modifier = Modifier.fillMaxWidth()
                )
                Button(onClick = {
                    val amount = transferAmount.toLongOrNull()
                    val currentWallet = wallet
                    if (currentWallet == null) {
                        statusMessage = "Create wallet first."
                        return@Button
                    }
                    if (amount == null || amount <= 0) {
                        statusMessage = "Enter a valid positive transfer amount."
                        return@Button
                    }
                    when (val result = WalletEngine.transferInternal(currentWallet, recipient, amount)) {
                        is TransferResult.Success -> {
                            wallet = result.wallet
                            transactions.add(result.transaction)
                            statusMessage = "Transfer successful."
                            step = JourneyStep.HISTORY
                        }

                        is TransferResult.Failure -> {
                            statusMessage = result.reason
                        }
                    }
                }) {
                    Text("Send Internal Transfer")
                }
            }

            JourneyStep.HISTORY -> {
                Text("Transaction history")
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(transactions) { tx ->
                        Text(
                            "${tx.type} • ${tx.amountMinor} • ${tx.counterparty} • ${tx.note}",
                            style = MaterialTheme.typography.body2
                        )
                    }
                }
            }
        }

        Text("Status: $statusMessage")
    }
}

@Preview(showBackground = true)
@Composable
fun DefaultPreview() {
    BenkiTheme {
        BankWithoutBordersApp()
    }
}
