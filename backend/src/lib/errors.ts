import { renderMsg, type ApiErrorBody, type ApiErrorCode, type Locale, type Msg } from "@benki/shared";

/** Customer-facing text: a translatable message, or plain English for staff/internal errors. */
export type Text = string | Msg;

export class ApiError extends Error {
  readonly text: Text;

  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    text: Text,
  ) {
    super(renderMsg("en", text));
    this.text = text;
  }

  /** Rendered in the caller's language when the message is translatable. */
  toBody(correlationId?: string, locale: Locale = "en"): ApiErrorBody {
    return { error: { code: this.code, message: renderMsg(locale, this.text), correlationId } };
  }
}

const m = (key: Msg["key"], params?: Msg["params"]): Msg => ({ key, params });

export const badRequest = (text: Text) => new ApiError(400, "VALIDATION_ERROR", text);
export const unauthorized = (text: Text = m("err.unauthorized")) => new ApiError(401, "AUTH_ERROR", text);
export const forbidden = (text: Text = m("err.tierRequired")) => new ApiError(403, "FORBIDDEN", text);
export const notFound = (text: Text) => new ApiError(404, "NOT_FOUND", text);
export const conflict = (text: Text) => new ApiError(409, "CONFLICT", text);
export const rateLimited = (text: Text = m("err.rateLimited")) => new ApiError(429, "RATE_LIMITED", text);
export const pinInvalid = (text: Text) => new ApiError(401, "PIN_INVALID", text);
export const pinLocked = (text: Text = m("err.pinLocked")) => new ApiError(423, "PIN_LOCKED", text);
export const limitExceeded = (text: Text) => new ApiError(422, "LIMIT_EXCEEDED", text);
export const insufficientFunds = (text: Text = m("err.insufficientFunds")) => new ApiError(422, "INSUFFICIENT_FUNDS", text);
export const providerUnavailable = (text: Text = m("err.providerUnavailable")) => new ApiError(502, "PROVIDER_UNAVAILABLE", text);

// Customer-facing compliance messages are deliberately generic: AML rules
// prohibit "tipping off" a customer that they are under suspicion.
export const complianceBlock = () => new ApiError(422, "COMPLIANCE_BLOCK", m("err.complianceBlock"));
export const accountRestricted = () => new ApiError(403, "ACCOUNT_RESTRICTED", m("err.accountRestricted"));
