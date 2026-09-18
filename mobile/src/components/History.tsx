import { FlatList, StyleSheet, Text, View } from "react-native";
import type { WalletTransaction } from "../types";
import { Card, SecondaryButton } from "./ui";
import { colors } from "../theme/colors";

interface Props {
  transactions: WalletTransaction[];
  onBackToTransfer: () => void;
}

export function History({ transactions, onBackToTransfer }: Props) {
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
            const isCredit = item.type !== "TRANSFER_OUT";
            return (
              <View style={styles.row}>
                <View>
                  <Text style={styles.type}>{item.type.replace("_", " ")}</Text>
                  <Text>{item.counterparty}</Text>
                  <Text>{item.note}</Text>
                </View>
                <Text style={[styles.amount, { color: isCredit ? colors.primary : colors.errorText }]}>
                  {isCredit ? "+" : "-"}
                  {item.amountMinor.toLocaleString()}
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
