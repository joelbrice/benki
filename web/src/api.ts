import type {
  AdminAlert,
  AdminCase,
  AdminDashboard,
  AdminMarket,
  AdminDispute,
  AdminTransaction,
  AdminUserView,
  ApiErrorBody,
  Approval,
  ApprovalAction,
  AuditEntry,
  AuditVerification,
  ConversionQuote,
  CurrencyPocket,
  Dispute,
  FeeQuote,
  FxQuote,
  KycResponse,
  LimitsResponse,
  Locale,
  Loan,
  LoanOffer,
  NameEnquiryResponse,
  Notification,
  OtpSendResponse,
  OtpVerifyResponse,
  PaymentRequest,
  PaymentResponse,
  PurposeCode,
  ReconciliationException,
  ReconciliationRun,
  SavingsGroup,
  SavingsVault,
  StaffLoginResponse,
  StrReport,
  TrialBalance,
  UserProfile,
  UserTransaction,
  WalletAccount,
} from "@benki/shared";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

/** The UI language, sent with every request so errors and confirmations come back translated. */
let requestLocale = "en";
export function setRequestLocale(locale: string) {
  requestLocale = locale;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error.message);
  }
  get code() {
    return this.body.error.code;
  }
}

/** Stable per-browser device ID; the API binds sessions to it. */
export function deviceId(): string {
  const storageKey = "benki.deviceId";
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = `web-${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return `web-ephemeral-${crypto.randomUUID()}`;
  }
}

/** One key per user intent: reuse it when retrying the same submission. */
export function newIdempotencyKey(): string {
  return `web-${crypto.randomUUID()}`;
}

async function request<T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "content-type": "application/json",
        "accept-language": requestLocale,
        "x-device-id": deviceId(),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiRequestError(0, { error: { code: "NETWORK_ERROR", message: "" } });
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiRequestError(res.status, json ?? { error: { code: "INTERNAL_ERROR", message: `Request failed (${res.status})` } });
  }
  return json as T;
}

export const authApi = {
  sendOtp: (phoneNumber: string, countryCode: string) =>
    request<OtpSendResponse>("/v1/auth/otp/send", { method: "POST", body: { phoneNumber, countryCode } }),
  joinWaitlist: (phoneNumber: string, countryCode: string, locale?: Locale) =>
    request<{ joined: true }>("/v1/markets/waitlist", { method: "POST", body: { phoneNumber, countryCode, locale } }),
  verifyOtp: (phoneNumber: string, otp: string, locale?: Locale) =>
    request<OtpVerifyResponse>("/v1/auth/otp/verify", { method: "POST", body: { phoneNumber, otp, locale } }),
};

interface Movement {
  idempotencyKey: string;
  amountMinor: number;
}
interface Pin {
  pin: string;
}

export function customerApi(token: string) {
  const get = <T>(path: string) => request<T>(path, { token });
  const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", token, body: body ?? {} });
  return {
    me: () => get<{ user: UserProfile; wallet: WalletAccount | null }>("/v1/me"),
    limits: () => get<LimitsResponse>("/v1/limits"),
    notifications: () => get<{ notifications: Notification[] }>("/v1/notifications"),
    markNotificationsRead: () => post<void>("/v1/notifications/read"),
    setLocale: (locale: Locale) => post<{ user: UserProfile }>("/v1/me/locale", { locale }),
    pockets: () => get<{ pockets: CurrencyPocket[] }>("/v1/pockets"),
    openPocket: (currency: string) => post<{ pockets: CurrencyPocket[] }>("/v1/pockets", { currency }),
    conversionQuote: (fromCurrency: string, toCurrency: string, sellAmountMinor: number) =>
      post<ConversionQuote>("/v1/pockets/quote", { fromCurrency, toCurrency, sellAmountMinor }),
    convert: (body: Pin & { idempotencyKey: string; quoteId: string }) =>
      post<PaymentResponse & { pockets: CurrencyPocket[] }>("/v1/pockets/convert", body),
    requests: () => get<{ requests: PaymentRequest[] }>("/v1/requests"),
    requestMoney: (payerPhoneNumber: string, amountMinor: number, note?: string) =>
      post<{ request: PaymentRequest }>("/v1/requests", { payerPhoneNumber, amountMinor, note }),
    payRequest: (requestId: string, body: Pin & { idempotencyKey: string }) =>
      post<PaymentResponse & { request: PaymentRequest }>(`/v1/requests/${requestId}/pay`, body),
    declineRequest: (requestId: string) => post<{ request: PaymentRequest }>(`/v1/requests/${requestId}/decline`),
    cancelRequest: (requestId: string) => post<{ request: PaymentRequest }>(`/v1/requests/${requestId}/cancel`),
    setPin: (pin: string) => post<{ user: UserProfile }>("/v1/me/pin", { pin }),
    changePin: (currentPin: string, newPin: string) => post<void>("/v1/me/pin/change", { currentPin, newPin }),
    kycTier1: (body: { fullName: string; dateOfBirth: string; nationalId: string }) => post<KycResponse>("/v1/kyc/tier1", body),
    kycTier2: () => post<KycResponse>("/v1/kyc/tier2", { proofOfAddressConfirmed: true, livenessCheckPassed: true }),
    createWallet: () => post<{ wallet: WalletAccount }>("/v1/wallets"),
    transactions: (walletId: string) => get<{ transactions: UserTransaction[] }>(`/v1/wallets/${walletId}/transactions?limit=100`),
    cashIn: (walletId: string, body: Movement & { agentId: string }) => post<PaymentResponse>(`/v1/wallets/${walletId}/cash-in`, body),
    cashOut: (walletId: string, body: Movement & Pin & { agentId: string }) => post<PaymentResponse>(`/v1/wallets/${walletId}/cash-out`, body),
    airtime: (walletId: string, body: Movement & Pin & { providerId: string; phoneNumber?: string }) =>
      post<PaymentResponse>(`/v1/wallets/${walletId}/airtime-topup`, body),
    p2p: (body: Movement & Pin & { destinationPhoneNumber: string; note?: string }) => post<PaymentResponse>("/v1/transfers/internal", body),
    mobileMoney: (body: Movement & Pin & { providerId: string; destinationPhoneNumber: string; note?: string }) =>
      post<PaymentResponse>("/v1/transfers/mobile-money", body),
    fxQuote: (destinationCountryCode: string, sendAmountMinor: number) =>
      post<FxQuote>("/v1/transfers/cross-border/quote", { destinationCountryCode, sendAmountMinor }),
    crossBorder: (body: Pin & { idempotencyKey: string; quoteId: string; destinationPhoneNumber: string; purposeCode: PurposeCode }) =>
      post<PaymentResponse>("/v1/transfers/cross-border", body),
    bill: (body: Movement & Pin & { billerId: string; accountNumber: string }) => post<PaymentResponse>("/v1/payments/bills", body),
    merchant: (body: Movement & Pin & { merchantCode: string; note?: string }) => post<PaymentResponse>("/v1/payments/merchant", body),
    nameEnquiry: (bankId: string, accountNumber: string) =>
      post<NameEnquiryResponse>("/v1/transfers/bank/name-enquiry", { bankId, accountNumber }),
    bankTransfer: (body: Movement & Pin & { bankId: string; accountNumber: string; accountName: string; note?: string }) =>
      post<PaymentResponse>("/v1/transfers/bank", body),
    loanOffer: () => get<LoanOffer>("/v1/loans/offer"),
    loans: () => get<{ loans: Loan[] }>("/v1/loans"),
    applyLoan: (body: Pin & { idempotencyKey: string; principalMinor: number }) =>
      post<PaymentResponse & { loan: Loan }>("/v1/loans", { ...body, acceptTerms: true }),
    repayLoan: (loanId: string, body: Movement & Pin) => post<PaymentResponse & { loan: Loan }>(`/v1/loans/${loanId}/repay`, body),
    groups: () => get<{ groups: SavingsGroup[] }>("/v1/groups"),
    createGroup: (name: string) => post<{ group: SavingsGroup }>("/v1/groups", { name }),
    addGroupMember: (groupId: string, phoneNumber: string) => post<{ group: SavingsGroup }>(`/v1/groups/${groupId}/members`, { phoneNumber }),
    contribute: (groupId: string, body: Movement & Pin) => post<PaymentResponse>(`/v1/groups/${groupId}/contribute`, body),
    requestPayout: (groupId: string, body: Pin & { recipientUserId: string; amountMinor: number; reason: string }) =>
      post<{ group: SavingsGroup }>(`/v1/groups/${groupId}/payouts`, body),
    votePayout: (groupId: string, requestId: string, approve: boolean, pin: string) =>
      post<{ group: SavingsGroup }>(`/v1/groups/${groupId}/payouts/${requestId}/vote`, { approve, pin }),
    vaults: () => get<{ vaults: SavingsVault[] }>("/v1/savings"),
    createVault: (name: string, targetMinor: number) => post<{ vault: SavingsVault }>("/v1/savings", { name, targetMinor }),
    vaultDeposit: (vaultId: string, body: Movement) => post<PaymentResponse>(`/v1/savings/${vaultId}/deposit`, body),
    vaultWithdraw: (vaultId: string, body: Movement) => post<PaymentResponse>(`/v1/savings/${vaultId}/withdraw`, body),
    disputes: () => get<{ disputes: Dispute[] }>("/v1/disputes"),
    openDispute: (transactionId: string, reason: string) => post<{ dispute: Dispute }>("/v1/disputes", { transactionId, reason }),
    pricing: (type: string, amountMinor: number) => get<FeeQuote>(`/v1/pricing/quote?type=${type}&amountMinor=${amountMinor}`),
    logout: () => post<void>("/v1/auth/logout"),
    async downloadStatement(walletId: string) {
      const res = await fetch(`${BASE_URL}/v1/wallets/${walletId}/statement.csv`, {
        headers: { authorization: `Bearer ${token}`, "x-device-id": deviceId() },
      });
      if (!res.ok) throw new ApiRequestError(res.status, await res.json());
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `benki-statement-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}

export type CustomerApi = ReturnType<typeof customerApi>;

/** Development-only USSD simulator: returns the raw "CON …" / "END …" screen. */
export async function ussdDial(sessionId: string, phoneNumber: string, text: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/v1/ussd/simulator`, {
      method: "POST",
      headers: { "content-type": "application/json", "accept-language": requestLocale },
      body: JSON.stringify({ sessionId, phoneNumber, text }),
    });
  } catch {
    return "END Network unavailable. Is the Benki API running?";
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as ApiErrorBody | null;
    return `END ${json?.error.message ?? `Request failed (${res.status})`}`;
  }
  return res.text();
}

export function adminApi(token: string) {
  const get = <T>(path: string) => request<T>(path, { token });
  const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", token, body: body ?? {} });
  const q = (status?: string) => (status ? `?status=${status}` : "");
  return {
    me: () => get<{ staffId: string; username: string; role: string }>("/v1/admin/me"),
    logout: () => post<void>("/v1/admin/logout"),
    dashboard: () => get<AdminDashboard>("/v1/admin/dashboard"),
    markets: () => get<{ markets: AdminMarket[] }>("/v1/admin/markets"),
    notifyWaitlist: (countryCode: string) => post<{ queued: number }>(`/v1/admin/markets/${countryCode}/notify-waitlist`),
    alerts: (status?: string) => get<{ alerts: AdminAlert[] }>(`/v1/admin/alerts${q(status)}`),
    resolveScreening: (alertId: string, decision: "CLEAR" | "CONFIRM", note: string) =>
      post<void>(`/v1/admin/alerts/${alertId}/screening`, { decision, note }),
    cases: (status?: string) => get<{ cases: AdminCase[] }>(`/v1/admin/cases${q(status)}`),
    caseNote: (caseId: string, note: string) => post<{ case: AdminCase }>(`/v1/admin/cases/${caseId}/notes`, { note }),
    closeCase: (caseId: string, resolution: string) => post<{ case: AdminCase }>(`/v1/admin/cases/${caseId}/close`, { resolution }),
    fileStr: (caseId: string, narrative: string) => post<{ str: StrReport }>(`/v1/admin/cases/${caseId}/str`, { narrative }),
    transactions: (status?: string) => get<{ transactions: AdminTransaction[] }>(`/v1/admin/transactions${q(status)}`),
    approveTransaction: (id: string) => post<{ transaction: AdminTransaction }>(`/v1/admin/transactions/${id}/approve`),
    rejectTransaction: (id: string, reason: string) => post<{ transaction: AdminTransaction }>(`/v1/admin/transactions/${id}/reject`, { reason }),
    searchUsers: (query: string) =>
      get<{ users: { userId: string; phoneNumber: string; fullName: string | null; countryCode: string; status: string; kycTier: string; screeningStatus: string }[] }>(
        `/v1/admin/users?query=${encodeURIComponent(query)}`,
      ),
    user: (userId: string) => get<{ user: AdminUserView }>(`/v1/admin/users/${userId}`),
    freeze: (userId: string, reason: string) => post<void>(`/v1/admin/users/${userId}/freeze`, { reason }),
    approvals: (status?: string) => get<{ approvals: Approval[] }>(`/v1/admin/approvals${q(status)}`),
    requestApproval: (action: ApprovalAction, payload: Record<string, unknown>, reason: string) =>
      post<{ approval: Approval }>("/v1/admin/approvals", { action, payload, reason }),
    decideApproval: (id: string, approve: boolean) => post<{ approval: Approval }>(`/v1/admin/approvals/${id}/${approve ? "approve" : "reject"}`),
    disputes: (status?: string) => get<{ disputes: AdminDispute[] }>(`/v1/admin/disputes${q(status)}`),
    rejectDispute: (id: string, resolution: string) => post<void>(`/v1/admin/disputes/${id}/reject`, { resolution }),
    disputeReversal: (id: string, reason: string) => post<{ approval: Approval }>(`/v1/admin/disputes/${id}/request-reversal`, { reason }),
    trialBalance: () => get<TrialBalance>("/v1/admin/ledger/trial-balance"),
    audit: () => get<{ entries: AuditEntry[] }>("/v1/admin/audit?limit=200"),
    verifyAudit: () => get<AuditVerification>("/v1/admin/audit/verify"),
    runSettlement: () => post<{ checked: number; completed: number; failed: number }>("/v1/admin/settlement/run"),
    runReconciliation: () => post<{ runs: ReconciliationRun[] }>("/v1/admin/reconciliation/run"),
    reconRuns: () => get<{ runs: ReconciliationRun[] }>("/v1/reconciliation/settlements"),
    reconExceptions: () => get<{ exceptions: ReconciliationException[] }>("/v1/reconciliation/exceptions"),
  };
}

export type AdminApi = ReturnType<typeof adminApi>;

export const staffLogin = (username: string, password: string) =>
  request<StaffLoginResponse>("/v1/admin/login", { method: "POST", body: { username, password } });
