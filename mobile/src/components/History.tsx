import { FlatList, StyleSheet, Text, View } from "react-native";
import { formatAmount, type WalletTransaction } from "../types";
import { Card, SecondaryButton } from "./ui";
import { colors } from "../theme/colors";

interface Props {
  transactions: WalletTransaction[];
  currency: string;
  onBackToTransfer: () => void;
}

const CREDIT_TYPES = new Set(["CASH_IN", "TRANSFER_IN"]);

export function History({ transactions, currency, onBackToTransfer }: Props) {
  return (
    <Card>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Transaction history</Text>
      {transactions.length === 0 ? (
        <Text>No transactions yet.</Text>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(tx) => `${tx.reference}-${tx.type}`}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const isCredit = CREDIT_TYPES.has(item.type);
            return (
              <View style={styles.row}>
                <View>
                  <Text style={styles.type}>{item.type.replace(/_/g, " ")}</Text>
                  <Text>{item.counterparty}</Text>
                  <Text>{item.note}</Text>
                </View>
                <Text style={[styles.amount, { color: isCredit ? colors.primary : colors.errorText }]}>
                  {isCredit ? "+" : "-"}
                  {formatAmount(item.amountMinor, currency)}
                </Text>
              </View>
            );
          }}
        />
      )}
      <SecondaryButton title="Send another transfer" onPress={onBackToTransfer} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.txBg,
  },
  type: { fontWeight: "700" },
  amount: { fontWeight: "700" },
});
