// Schema v1. Money is always INTEGER minor units. Postings, journal entries
// and the audit log are append-only, enforced by triggers rather than by
// convention (docs/LEDGER_RECONCILIATION_SPEC.md: "No direct balance mutation
// without postings", immutable postings, full audit logs).

export const SCHEMA_VERSION = 1;

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  country_code TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'CUSTOMER' CHECK (kind IN ('CUSTOMER', 'MERCHANT')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'CLOSED')),
  kyc_tier TEXT NOT NULL DEFAULT 'TIER_0' CHECK (kyc_tier IN ('TIER_0', 'TIER_1', 'TIER_2')),
  kyc_review_pending INTEGER NOT NULL DEFAULT 0,
  full_name TEXT,
  date_of_birth TEXT,
  national_id_enc TEXT,
  national_id_hash TEXT UNIQUE,
  national_id_last4 TEXT,
  proof_of_address INTEGER NOT NULL DEFAULT 0,
  liveness_passed INTEGER NOT NULL DEFAULT 0,
  screening_status TEXT NOT NULL DEFAULT 'NOT_SCREENED'
    CHECK (screening_status IN ('NOT_SCREENED', 'CLEAR', 'POTENTIAL_MATCH', 'CONFIRMED_MATCH')),
  screening_matches TEXT NOT NULL DEFAULT '[]',
  pin_hash TEXT,
  pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TEXT,
  wallet_account_id TEXT,
  merchant_code TEXT UNIQUE,
  created_at TEXT NOT NULL,
  last_activity_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  currency TEXT NOT NULL,
  owner_id TEXT,
  label TEXT NOT NULL,
  allow_negative INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts (owner_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entries_tx ON journal_entries (transaction_id);

CREATE TABLE IF NOT EXISTS postings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL REFERENCES journal_entries (id),
  account_id TEXT NOT NULL REFERENCES accounts (id),
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor <> 0),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_postings_account ON postings (account_id);
CREATE INDEX IF NOT EXISTS idx_postings_entry ON postings (entry_id);

CREATE TRIGGER IF NOT EXISTS postings_currency_matches_account
BEFORE INSERT ON postings
WHEN NEW.currency <> (SELECT currency FROM accounts WHERE id = NEW.account_id)
BEGIN SELECT RAISE(ABORT, 'posting currency must match account currency'); END;

CREATE TRIGGER IF NOT EXISTS postings_immutable_update BEFORE UPDATE ON postings
BEGIN SELECT RAISE(ABORT, 'postings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS postings_immutable_delete BEFORE DELETE ON postings
BEGIN SELECT RAISE(ABORT, 'postings are immutable'); END;
CREATE TRIGGER IF NOT EXISTS entries_immutable_update BEFORE UPDATE ON journal_entries
BEGIN SELECT RAISE(ABORT, 'journal entries are immutable'); END;
CREATE TRIGGER IF NOT EXISTS entries_immutable_delete BEFORE DELETE ON journal_entries
BEGIN SELECT RAISE(ABORT, 'journal entries are immutable'); END;

CREATE TABLE IF NOT EXISTS holds (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id),
  transaction_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'RELEASED', 'CAPTURED')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_holds_account ON holds (account_id, status);
CREATE INDEX IF NOT EXISTS idx_holds_tx ON holds (transaction_id);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  initiator_user_id TEXT NOT NULL REFERENCES users (id),
  counterparty_user_id TEXT REFERENCES users (id),
  source_account_id TEXT REFERENCES accounts (id),
  destination_account_id TEXT REFERENCES accounts (id),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  merchant_fee_minor INTEGER NOT NULL DEFAULT 0 CHECK (merchant_fee_minor >= 0),
  currency TEXT NOT NULL,
  receive_amount_minor INTEGER,
  receive_currency TEXT,
  counterparty_label TEXT NOT NULL,
  counterparty_key TEXT,
  note TEXT NOT NULL DEFAULT '',
  provider_id TEXT,
  provider_ref TEXT,
  token TEXT,
  purpose_code TEXT,
  risk_decision TEXT,
  risk_score INTEGER,
  rule_hits TEXT NOT NULL DEFAULT '[]',
  reversal_of TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tx_initiator ON transactions (initiator_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_counterparty ON transactions (counterparty_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_tx_provider_ref ON transactions (provider_ref);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status_code INTEGER,
  response TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS otps (
  phone TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  device_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS devices (
  user_id TEXT NOT NULL REFERENCES users (id),
  device_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, device_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('TRANSACTION', 'SCREENING')),
  user_id TEXT NOT NULL REFERENCES users (id),
  transaction_id TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('MEDIUM', 'HIGH', 'CRITICAL')),
  rule_hits TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED')),
  case_id TEXT,
  resolution TEXT,
  created_at TEXT NOT NULL,
  closed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED_NO_ACTION', 'CLOSED_STR_FILED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_by TEXT,
  resolution TEXT
);

CREATE TABLE IF NOT EXISTS case_notes (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases (id),
  staff_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS str_reports (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL UNIQUE REFERENCES cases (id),
  reference TEXT NOT NULL UNIQUE,
  filed_by TEXT NOT NULL,
  payload TEXT NOT NULL,
  filed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ANALYST', 'SUPERVISOR', 'ADMIN')),
  active INTEGER NOT NULL DEFAULT 1,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_sessions (
  token_hash TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL REFERENCES staff (id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('REVERSAL', 'UNFREEZE', 'MANUAL_ADJUSTMENT')),
  payload TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'FAILED')),
  requested_by TEXT NOT NULL REFERENCES staff (id),
  requested_at TEXT NOT NULL,
  decided_by TEXT REFERENCES staff (id),
  decided_at TEXT,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL UNIQUE REFERENCES transactions (id),
  user_id TEXT NOT NULL REFERENCES users (id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'RESOLVED_REVERSED', 'RESOLVED_REJECTED')),
  approval_id TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolution TEXT
);

CREATE TABLE IF NOT EXISTS savings_vaults (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  account_id TEXT NOT NULL REFERENCES accounts (id),
  name TEXT NOT NULL,
  target_minor INTEGER NOT NULL CHECK (target_minor > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at);

CREATE TABLE IF NOT EXISTS fx_quotes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  destination_country TEXT NOT NULL,
  send_currency TEXT NOT NULL,
  receive_currency TEXT NOT NULL,
  send_amount_minor INTEGER NOT NULL,
  fee_minor INTEGER NOT NULL,
  receive_amount_minor INTEGER NOT NULL,
  rate REAL NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_immutable_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_immutable_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;

-- Sandbox only: stands in for the external provider's own books so that
-- reconciliation has something independent to compare against.
CREATE TABLE IF NOT EXISTS provider_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  provider_ref TEXT NOT NULL,
  destination TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_provider_records_ref ON provider_records (provider_ref);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recon_runs (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  ran_at TEXT NOT NULL,
  matched INTEGER NOT NULL,
  exceptions INTEGER NOT NULL,
  internal_settlement_minor INTEGER NOT NULL,
  provider_settlement_minor INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS recon_exceptions (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES recon_runs (id),
  provider_id TEXT NOT NULL,
  category TEXT NOT NULL,
  transaction_id TEXT,
  provider_ref TEXT,
  internal_amount_minor INTEGER,
  provider_amount_minor INTEGER,
  internal_status TEXT,
  provider_status TEXT,
  created_at TEXT NOT NULL
);
`;
