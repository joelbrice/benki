import type {
  AccountStatus,
  KycTier,
  RiskDecision,
  ScreeningStatus,
  StaffRole,
  TransactionStatus,
  TransactionType,
} from "@benki/shared";

export interface UserRow {
  id: string;
  phone: string;
  country_code: string;
  kind: "CUSTOMER" | "MERCHANT";
  status: AccountStatus;
  kyc_tier: KycTier;
  kyc_review_pending: number;
  full_name: string | null;
  date_of_birth: string | null;
  national_id_enc: string | null;
  national_id_hash: string | null;
  national_id_last4: string | null;
  proof_of_address: number;
  liveness_passed: number;
  screening_status: ScreeningStatus;
  screening_matches: string;
  pin_hash: string | null;
  pin_failed_attempts: number;
  pin_locked_until: string | null;
  wallet_account_id: string | null;
  merchant_code: string | null;
  created_at: string;
  last_activity_at: string | null;
}

export interface AccountRow {
  id: string;
  kind: string;
  currency: string;
  owner_id: string | null;
  label: string;
  allow_negative: number;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  initiator_user_id: string;
  counterparty_user_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount_minor: number;
  fee_minor: number;
  merchant_fee_minor: number;
  currency: string;
  receive_amount_minor: number | null;
  receive_currency: string | null;
  counterparty_label: string;
  counterparty_key: string | null;
  note: string;
  provider_id: string | null;
  provider_ref: string | null;
  token: string | null;
  purpose_code: string | null;
  risk_decision: RiskDecision | null;
  risk_score: number | null;
  rule_hits: string;
  reversal_of: string | null;
  metadata: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface SessionRow {
  token_hash: string;
  user_id: string;
  device_id: string;
  created_at: string;
  expires_at: string;
  revoked: number;
}

export interface StaffRow {
  id: string;
  username: string;
  password_hash: string;
  role: StaffRole;
  active: number;
  failed_logins: number;
  locked_until: string | null;
  created_at: string;
}

export interface AlertRow {
  id: string;
  kind: "TRANSACTION" | "SCREENING";
  user_id: string;
  transaction_id: string | null;
  severity: "MEDIUM" | "HIGH" | "CRITICAL";
  rule_hits: string;
  status: "OPEN" | "CLOSED";
  case_id: string | null;
  resolution: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface CaseRow {
  id: string;
  user_id: string;
  status: "OPEN" | "CLOSED_NO_ACTION" | "CLOSED_STR_FILED";
  created_at: string;
  updated_at: string;
  closed_by: string | null;
  resolution: string | null;
}

export interface ApprovalRow {
  id: string;
  action: "REVERSAL" | "UNFREEZE" | "MANUAL_ADJUSTMENT";
  payload: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "FAILED";
  requested_by: string;
  requested_at: string;
  decided_by: string | null;
  decided_at: string | null;
  failure_reason: string | null;
}

export interface DisputeRow {
  id: string;
  transaction_id: string;
  user_id: string;
  reason: string;
  status: "OPEN" | "RESOLVED_REVERSED" | "RESOLVED_REJECTED";
  approval_id: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
}

export interface VaultRow {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  target_minor: number;
  created_at: string;
}
