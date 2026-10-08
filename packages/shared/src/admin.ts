import type { AccountStatus, TransactionStatus, TransactionType, UserTransaction } from "./contracts";
import type { KycTier } from "./limits";

export type StaffRole = "ANALYST" | "SUPERVISOR" | "ADMIN";

export type RiskDecision = "ALLOW" | "REVIEW" | "BLOCK";

export type ScreeningStatus = "NOT_SCREENED" | "CLEAR" | "POTENTIAL_MATCH" | "CONFIRMED_MATCH";

export interface RuleHit {
  code: string;
  description: string;
  outcome: RiskDecision;
  score: number;
}

export interface StaffLoginRequest {
  username: string;
  password: string;
}

export interface StaffLoginResponse {
  token: string;
  expiresAt: string;
  staff: { staffId: string; username: string; role: StaffRole };
}

export type AlertStatus = "OPEN" | "CLOSED";
export type AlertKind = "TRANSACTION" | "SCREENING";

export interface AdminAlert {
  alertId: string;
  kind: AlertKind;
  userId: string;
  userPhone: string;
  transactionId: string | null;
  severity: "MEDIUM" | "HIGH" | "CRITICAL";
  rules: RuleHit[];
  status: AlertStatus;
  caseId: string | null;
  createdAt: string;
}

export type CaseStatus = "OPEN" | "CLOSED_NO_ACTION" | "CLOSED_STR_FILED";

export interface AdminCaseNote {
  staffUsername: string;
  note: string;
  createdAt: string;
}

export interface StrReport {
  reportId: string;
  reference: string;
  caseId: string;
  filedBy: string;
  filedAt: string;
  payload: Record<string, unknown>;
}

export interface AdminCase {
  caseId: string;
  userId: string;
  userPhone: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  alerts: AdminAlert[];
  notes: AdminCaseNote[];
  str: StrReport | null;
}

export interface AdminTransaction extends Omit<UserTransaction, "direction" | "disputable"> {
  initiatorUserId: string;
  initiatorPhone: string;
  counterpartyUserId: string | null;
  riskDecision: RiskDecision | null;
  riskScore: number | null;
  ruleHits: RuleHit[];
  providerId: string | null;
  providerRef: string | null;
}

export interface AdminUserView {
  userId: string;
  phoneNumber: string;
  countryCode: string;
  status: AccountStatus;
  kycTier: KycTier;
  fullName: string | null;
  dateOfBirth: string | null;
  /** Masked for analysts; supervisors and admins see the decrypted value. */
  nationalId: string | null;
  screeningStatus: ScreeningStatus;
  screeningMatches: { listName: string; matchedName: string; similarity: number }[];
  pinLocked: boolean;
  createdAt: string;
  lastActivityAt: string | null;
  devices: { deviceId: string; firstSeenAt: string; lastSeenAt: string }[];
  walletBalanceMinor: number | null;
  currency: string | null;
  transactions: AdminTransaction[];
  alerts: AdminAlert[];
}

export type ApprovalAction = "REVERSAL" | "UNFREEZE" | "MANUAL_ADJUSTMENT";

export interface Approval {
  approvalId: string;
  action: ApprovalAction;
  payload: Record<string, unknown>;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FAILED";
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  failureReason: string | null;
}

export interface TrialBalance {
  balanced: boolean;
  currencies: { currency: string; totalDebitsMinor: number; totalCreditsMinor: number; netMinor: number }[];
  unbalancedEntries: string[];
  negativeCustomerAccounts: string[];
  accountsByKind: { kind: string; currency: string; balanceMinor: number }[];
  checkedAt: string;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actorType: "USER" | "STAFF" | "SYSTEM";
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  hash: string;
}

export interface AuditVerification {
  valid: boolean;
  checked: number;
  firstBrokenSeq: number | null;
}

export type ReconciliationBreak =
  | "MISSING_PROVIDER_REFERENCE"
  | "AMOUNT_MISMATCH"
  | "STATUS_MISMATCH"
  | "DUPLICATE_SETTLEMENT_ENTRY"
  | "UNMATCHED_PROVIDER_RECORD";

export interface ReconciliationException {
  exceptionId: string;
  runId: string;
  providerId: string;
  category: ReconciliationBreak;
  transactionId: string | null;
  providerRef: string | null;
  internalAmountMinor: number | null;
  providerAmountMinor: number | null;
  internalStatus: TransactionStatus | null;
  providerStatus: string | null;
  createdAt: string;
}

export interface ReconciliationRun {
  runId: string;
  providerId: string;
  ranAt: string;
  matched: number;
  exceptions: number;
  internalSettlementMinor: number;
  providerSettlementMinor: number;
  currency: string;
}

export interface AdminDashboard {
  users: number;
  frozenUsers: number;
  openAlerts: number;
  openCases: number;
  pendingReview: number;
  pendingApprovals: number;
  pendingProviderPayouts: number;
  openDisputes: number;
  volumeByType: { type: TransactionType; currency: string; count: number; amountMinor: number }[];
  statusCounts: { status: TransactionStatus; count: number }[];
}

export interface AdminDispute {
  disputeId: string;
  transactionId: string;
  userId: string;
  userPhone: string;
  reason: string;
  status: "OPEN" | "RESOLVED_REVERSED" | "RESOLVED_REJECTED";
  createdAt: string;
  resolution: string | null;
  /** Set while an upheld dispute's reversal waits for a second approver. */
  approvalId: string | null;
  transaction: AdminTransaction | null;
}
