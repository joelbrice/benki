import type { KycTier } from "./limits";
import type { PurposeCode } from "./catalog";

export type AccountStatus = "ACTIVE" | "FROZEN" | "CLOSED";

export type TransactionType =
  | "CASH_IN"
  | "CASH_OUT"
  | "P2P"
  | "MOBILE_MONEY_PAYOUT"
  | "AIRTIME"
  | "BILL_PAYMENT"
  | "MERCHANT_PAYMENT"
  | "CROSS_BORDER"
  | "SAVINGS_DEPOSIT"
  | "SAVINGS_WITHDRAWAL"
  | "BANK_TRANSFER"
  | "LOAN_DISBURSEMENT"
  | "LOAN_REPAYMENT"
  | "GROUP_CONTRIBUTION"
  | "GROUP_PAYOUT"
  | "REVERSAL"
  | "ADJUSTMENT";

/**
 * PENDING: dispatched to an external rail, awaiting confirmation.
 * PENDING_REVIEW: held for compliance review (funds reserved, nothing posted).
 * BLOCKED: refused by a compliance control; nothing moved.
 */
export type TransactionStatus =
  | "PENDING"
  | "PENDING_REVIEW"
  | "COMPLETED"
  | "FAILED"
  | "REJECTED"
  | "BLOCKED"
  | "REVERSED";

export type Direction = "CREDIT" | "DEBIT";

export interface UserProfile {
  userId: string;
  phoneNumber: string;
  countryCode: string;
  status: AccountStatus;
  kycTier: KycTier;
  /** True while a KYC upgrade is waiting on a compliance decision. */
  kycReviewPending: boolean;
  walletId: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  nationalIdMasked: string | null;
  proofOfAddressConfirmed: boolean;
  pinSet: boolean;
  createdAt: string;
}

export interface WalletAccount {
  walletId: string;
  ownerUserId: string;
  currency: string;
  /** Sum of immutable ledger postings. */
  ledgerBalanceMinor: number;
  /** Ledger balance minus reserved holds — what the customer can spend. */
  availableBalanceMinor: number;
  /** Funds held for transactions under compliance review. */
  reservedBalanceMinor: number;
  /** Outgoing payouts dispatched to an external rail and not yet confirmed. */
  pendingBalanceMinor: number;
}

export interface UserTransaction {
  id: string;
  type: TransactionType;
  direction: Direction;
  status: TransactionStatus;
  amountMinor: number;
  feeMinor: number;
  currency: string;
  counterparty: string;
  note: string;
  createdAt: string;
  completedAt: string | null;
  receiveAmountMinor: number | null;
  receiveCurrency: string | null;
  /** Prepaid electricity token, when the biller issues one. */
  token: string | null;
  disputable: boolean;
}

export interface PaymentResponse {
  transaction: UserTransaction;
  wallet: WalletAccount;
  /** Customer-safe status message. Never names the compliance rule involved. */
  message: string;
}

export interface LimitsResponse {
  kycTier: KycTier;
  currency: string;
  perTransactionMinor: number;
  dailyLimitMinor: number;
  dailyUsedMinor: number;
  monthlyLimitMinor: number;
  monthlyUsedMinor: number;
  maxBalanceMinor: number;
  totalHoldingsMinor: number;
}

export interface Notification {
  id: string;
  kind: "SECURITY" | "TRANSACTION" | "ACCOUNT";
  message: string;
  createdAt: string;
  read: boolean;
}

export interface SavingsVault {
  vaultId: string;
  name: string;
  currency: string;
  targetMinor: number;
  balanceMinor: number;
  createdAt: string;
}

export interface FxQuote {
  quoteId: string;
  sendCurrency: string;
  sendAmountMinor: number;
  feeMinor: number;
  totalDebitMinor: number;
  receiveCurrency: string;
  receiveAmountMinor: number;
  /** Units of receive currency per 1 unit of send currency, after margin. */
  rate: number;
  expiresAt: string;
}

export interface FeeQuote {
  type: string;
  currency: string;
  amountMinor: number;
  feeMinor: number;
  totalDebitMinor: number;
  description: string;
}

export interface Dispute {
  disputeId: string;
  transactionId: string;
  reason: string;
  status: "OPEN" | "RESOLVED_REVERSED" | "RESOLVED_REJECTED";
  createdAt: string;
  resolution: string | null;
}

// --- Requests ---------------------------------------------------------------

export interface OtpSendRequest {
  phoneNumber: string;
  countryCode: string;
}

export interface OtpSendResponse {
  requestId: string;
  /** Only present when the server runs with BENKI_EXPOSE_DEV_OTP (never in production). */
  devOtp?: string;
  resendAfterSeconds: number;
}

export interface OtpVerifyRequest {
  phoneNumber: string;
  otp: string;
}

export interface OtpVerifyResponse {
  token: string;
  expiresAt: string;
  user: UserProfile;
}

export interface PinSetRequest {
  pin: string;
}

export interface PinChangeRequest {
  currentPin: string;
  newPin: string;
}

export interface KycTier1Request {
  fullName: string;
  dateOfBirth: string;
  nationalId: string;
}

export interface KycTier2Request {
  proofOfAddressConfirmed: boolean;
  livenessCheckPassed: boolean;
}

export interface KycResponse {
  user: UserProfile;
  message: string;
}

interface MoneyMovement {
  idempotencyKey: string;
  amountMinor: number;
}

interface PinProtected {
  pin: string;
}

export interface CashInRequest extends MoneyMovement {
  agentId: string;
}

export interface CashOutRequest extends MoneyMovement, PinProtected {
  agentId: string;
}

export interface InternalTransferRequest extends MoneyMovement, PinProtected {
  destinationPhoneNumber: string;
  note?: string;
}

export interface MobileMoneyTransferRequest extends MoneyMovement, PinProtected {
  providerId: string;
  destinationPhoneNumber: string;
  note?: string;
}

export interface AirtimeTopUpRequest extends MoneyMovement, PinProtected {
  providerId: string;
  phoneNumber?: string;
}

export interface BillPaymentRequest extends MoneyMovement, PinProtected {
  billerId: string;
  accountNumber: string;
}

export interface MerchantPaymentRequest extends MoneyMovement, PinProtected {
  merchantCode: string;
  note?: string;
}

export interface FxQuoteRequest {
  destinationCountryCode: string;
  sendAmountMinor: number;
}

export interface CrossBorderTransferRequest extends PinProtected {
  idempotencyKey: string;
  quoteId: string;
  destinationPhoneNumber: string;
  purposeCode: PurposeCode;
}

export interface SavingsVaultCreateRequest {
  name: string;
  targetMinor: number;
}

export interface SavingsMovementRequest extends MoneyMovement {}

export interface DisputeRequest {
  transactionId: string;
  reason: string;
}

// --- Errors -----------------------------------------------------------------

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_ERROR"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PIN_INVALID"
  | "PIN_LOCKED"
  | "COMPLIANCE_BLOCK"
  | "LIMIT_EXCEEDED"
  | "INSUFFICIENT_FUNDS"
  | "ACCOUNT_RESTRICTED"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    correlationId?: string;
  };
}

// --- Bank transfers -----------------------------------------------------------

export interface NameEnquiryResponse {
  bankId: string;
  accountNumber: string;
  /** Name the receiving bank holds for the account — shown before the customer confirms. */
  accountName: string;
}

export interface BankTransferRequest extends MoneyMovement, PinProtected {
  bankId: string;
  accountNumber: string;
  /** The name returned by name enquiry, echoed back so a stale confirmation is detected. */
  accountName: string;
  note?: string;
}

// --- Nano-loans -----------------------------------------------------------------

export type LoanStatus = "ACTIVE" | "OVERDUE" | "REPAID";

export interface LoanOffer {
  eligible: boolean;
  /** Customer-safe reasons when not eligible. */
  reasons: string[];
  currency: string;
  minPrincipalMinor: number;
  maxPrincipalMinor: number;
  feeBps: number;
  termDays: number;
  aprPercent: number;
}

export interface Loan {
  loanId: string;
  currency: string;
  principalMinor: number;
  feeMinor: number;
  totalDueMinor: number;
  repaidMinor: number;
  outstandingMinor: number;
  status: LoanStatus;
  disbursedAt: string;
  dueAt: string;
  repaidAt: string | null;
}

export interface LoanApplyRequest extends PinProtected {
  idempotencyKey: string;
  principalMinor: number;
  /** Explicit acceptance of the disclosed fee, total and due date. */
  acceptTerms: true;
}

export interface LoanRepayRequest extends MoneyMovement, PinProtected {}

// --- Group savings (chama / tontine / susu) ---------------------------------------

export interface GroupMember {
  userId: string;
  displayName: string;
  role: "ADMIN" | "MEMBER";
  contributedMinor: number;
  joinedAt: string;
}

export interface GroupPayoutRequest {
  requestId: string;
  recipientUserId: string;
  recipientName: string;
  amountMinor: number;
  reason: string;
  status: "PENDING" | "EXECUTED" | "REJECTED";
  approvals: number;
  rejections: number;
  myVote: "APPROVE" | "REJECT" | null;
  requestedBy: string;
  createdAt: string;
  transactionId: string | null;
}

export interface SavingsGroup {
  groupId: string;
  name: string;
  currency: string;
  poolBalanceMinor: number;
  approvalsRequired: number;
  myRole: "ADMIN" | "MEMBER";
  members: GroupMember[];
  payoutRequests: GroupPayoutRequest[];
  createdAt: string;
}
