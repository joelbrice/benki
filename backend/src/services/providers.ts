import type { Db } from "../db/database";
import { all, one, run } from "../db/query";
import type { Clock } from "../lib/clock";

// Normalized provider statuses (docs/API_SPECIFICATION.md section 4).
export type ProviderStatus = "PENDING" | "COMPLETED" | "FAILED" | "REVERSED";

export interface ProviderRecord {
  providerRef: string;
  amountMinor: number;
  currency: string;
  status: ProviderStatus;
}

export interface WebhookEvent {
  eventId: string;
  providerRef: string;
  status: ProviderStatus;
}

/** The adapter contract every rail connector implements. */
export interface ProviderAdapter {
  readonly id: string;
  authorize(): Promise<void>;
  quote(amountMinor: number, currency: string): Promise<{ providerFeeMinor: number }>;
  initiateTransfer(request: {
    reference: string;
    amountMinor: number;
    currency: string;
    destination: string;
  }): Promise<{ providerRef: string; status: ProviderStatus }>;
  fetchStatus(providerRef: string): Promise<ProviderStatus>;
  handleWebhook(payload: unknown): WebhookEvent;
  reconcileBatch(currency: string): Promise<ProviderRecord[]>;
}

export class ProviderUnavailableError extends Error {}

interface RecordRow {
  id: number;
  provider_ref: string;
  destination: string;
  amount_minor: number;
  currency: string;
  status: ProviderStatus;
  created_at: string;
}

/**
 * Sandbox mobile money connector. Like card-network test numbers, the last
 * four digits of the destination select an outcome so every failure path —
 * including each reconciliation break category — can be exercised on demand:
 *   ...4444  provider outage at initiation (nothing is debited)
 *   ...0000  payout fails; customer is refunded
 *   ...5555  we're told FAILED, but the provider settles it   → STATUS_MISMATCH
 *   ...9999  provider settles a different amount             → AMOUNT_MISMATCH
 *   ...8888  provider books the settlement twice             → DUPLICATE_SETTLEMENT_ENTRY
 *   anything else completes after the configured latency.
 */
export class SandboxMobileMoneyAdapter implements ProviderAdapter {
  constructor(
    readonly id: string,
    private readonly db: Db,
    private readonly clock: Clock,
    private readonly latencyMs: number,
  ) {}

  async authorize() {}

  async quote() {
    return { providerFeeMinor: 0 };
  }

  async initiateTransfer(request: { reference: string; amountMinor: number; currency: string; destination: string }) {
    if (request.destination.endsWith("4444")) throw new ProviderUnavailableError(`${this.id} is unavailable`);
    const providerRef = `${this.id}-${request.reference}`;
    const existing = one<RecordRow>(this.db, "SELECT * FROM provider_records WHERE provider_ref = ?", providerRef);
    if (existing) return { providerRef, status: existing.status };
    const now = this.clock.now().toISOString();
    run(
      this.db,
      `INSERT INTO provider_records (provider_id, provider_ref, destination, amount_minor, currency, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)`,
      this.id,
      providerRef,
      request.destination,
      request.amountMinor,
      request.currency,
      now,
      now,
    );
    return { providerRef, status: "PENDING" as const };
  }

  async fetchStatus(providerRef: string): Promise<ProviderStatus> {
    const record = one<RecordRow>(
      this.db,
      "SELECT * FROM provider_records WHERE provider_ref = ? ORDER BY id LIMIT 1",
      providerRef,
    );
    if (!record) return "FAILED";
    const reportedToUs = (status: ProviderStatus) => (record.destination.endsWith("5555") ? "FAILED" : status);
    if (record.status !== "PENDING") return reportedToUs(record.status);

    const age = this.clock.now().getTime() - new Date(record.created_at).getTime();
    if (age < this.latencyMs) return "PENDING";

    const now = this.clock.now().toISOString();
    const final: ProviderStatus = record.destination.endsWith("0000") ? "FAILED" : "COMPLETED";
    const settledAmount = record.destination.endsWith("9999") ? record.amount_minor + 1 : record.amount_minor;
    run(
      this.db,
      "UPDATE provider_records SET status = ?, amount_minor = ?, updated_at = ? WHERE id = ?",
      final,
      settledAmount,
      now,
      record.id,
    );
    if (record.destination.endsWith("8888")) {
      run(
        this.db,
        `INSERT INTO provider_records (provider_id, provider_ref, destination, amount_minor, currency, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'COMPLETED', ?, ?)`,
        this.id,
        providerRef,
        record.destination,
        record.amount_minor,
        record.currency,
        now,
        now,
      );
    }
    return reportedToUs(final);
  }

  handleWebhook(payload: unknown): WebhookEvent {
    const body = payload as Partial<{ eventId: string; providerRef: string; status: string }>;
    if (!body?.eventId || !body.providerRef || !body.status) throw new Error("Malformed webhook payload");
    const mapping: Record<string, ProviderStatus> = {
      SUCCESS: "COMPLETED",
      COMPLETED: "COMPLETED",
      FAILED: "FAILED",
      REVERSED: "REVERSED",
      PENDING: "PENDING",
    };
    const status = mapping[body.status.toUpperCase()];
    if (!status) throw new Error(`Unknown provider status ${body.status}`);
    return { eventId: body.eventId, providerRef: body.providerRef, status };
  }

  async reconcileBatch(currency: string): Promise<ProviderRecord[]> {
    return all<RecordRow>(
      this.db,
      "SELECT * FROM provider_records WHERE provider_id = ? AND currency = ? ORDER BY id",
      this.id,
      currency,
    ).map((r) => ({ providerRef: r.provider_ref, amountMinor: r.amount_minor, currency: r.currency, status: r.status }));
  }
}

/**
 * Telco risk signals. Several African MNOs expose SIM-swap lookups because
 * SIM-swap account takeover is a leading mobile money fraud vector. Sandbox:
 * numbers ending in 77 report a SIM swap 12 hours ago.
 */
export interface TelcoSignals {
  simSwapWithinHours(phone: string): number | null;
}

export const sandboxTelco: TelcoSignals = {
  simSwapWithinHours: (phone) => (phone.endsWith("77") ? 12 : null),
};
