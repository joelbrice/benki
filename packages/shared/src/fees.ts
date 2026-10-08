export type FeeBearingType =
  | "P2P"
  | "CASH_IN"
  | "CASH_OUT"
  | "MOBILE_MONEY_PAYOUT"
  | "AIRTIME"
  | "BILL_PAYMENT"
  | "MERCHANT_PAYMENT"
  | "CROSS_BORDER"
  | "BANK_TRANSFER"
  | "GROUP_CONTRIBUTION";

export interface FeeRule {
  /** Charged to the customer on top of the amount, in basis points. */
  customerBps: number;
  /** Merchant discount rate, deducted from what the merchant receives. */
  merchantBps: number;
  description: string;
}

// Published fee schedule — docs/COUNTRY_COMPLIANCE_MATRIX.md lists fee
// transparency as a consumer-protection requirement, so the same table drives
// both the charge and what the apps show before the customer confirms.
export const FEE_SCHEDULE: Record<FeeBearingType, FeeRule> = {
  P2P: { customerBps: 0, merchantBps: 0, description: "Free between Benki users" },
  CASH_IN: { customerBps: 0, merchantBps: 0, description: "Free deposits at agents" },
  CASH_OUT: { customerBps: 50, merchantBps: 0, description: "0.5% agent withdrawal fee" },
  MOBILE_MONEY_PAYOUT: { customerBps: 100, merchantBps: 0, description: "1% to other mobile money wallets" },
  AIRTIME: { customerBps: 0, merchantBps: 0, description: "Free airtime and data" },
  BILL_PAYMENT: { customerBps: 0, merchantBps: 0, description: "Free bill payments" },
  MERCHANT_PAYMENT: { customerBps: 0, merchantBps: 100, description: "Free for customers; merchants pay 1%" },
  CROSS_BORDER: { customerBps: 150, merchantBps: 0, description: "1.5% plus a 1% FX margin on the rate" },
  BANK_TRANSFER: { customerBps: 50, merchantBps: 0, description: "0.5% to bank accounts" },
  GROUP_CONTRIBUTION: { customerBps: 0, merchantBps: 0, description: "Free contributions to your savings group" },
};

export const FX_MARGIN_BPS = 100;

function bpsOf(amountMinor: number, bps: number): number {
  return bps === 0 ? 0 : Math.ceil((amountMinor * bps) / 10_000);
}

export function customerFeeMinor(type: FeeBearingType, amountMinor: number): number {
  return bpsOf(amountMinor, FEE_SCHEDULE[type].customerBps);
}

export function merchantFeeMinor(type: FeeBearingType, amountMinor: number): number {
  return bpsOf(amountMinor, FEE_SCHEDULE[type].merchantBps);
}
