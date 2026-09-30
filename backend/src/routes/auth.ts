import { randomInt, randomUUID } from "crypto";
import { Router } from "express";
import { COUNTRY_BY_CODE, type OtpSendRequest, type OtpSendResponse, type OtpVerifyRequest, type OtpVerifyResponse } from "@benki/shared";
import { createUser, otpByPhone, tokens, usersByPhone } from "../store";
import { badRequest, unauthorized } from "../errors";

export const authRouter = Router();

const OTP_TTL_MS = 5 * 60 * 1000;

authRouter.post("/otp/send", (req, res) => {
  const body = req.body as Partial<OtpSendRequest>;
  if (!body.phoneNumber?.trim()) throw badRequest("phoneNumber is required");
  if (!body.countryCode?.trim()) throw badRequest("countryCode is required");
  if (!COUNTRY_BY_CODE[body.countryCode]) {
    throw badRequest(`Unsupported country ${body.countryCode}`);
  }

  const otp = String(randomInt(0, 1_000_000)).padStart(6, "0");
  otpByPhone.set(body.phoneNumber, { otp, expiresAt: Date.now() + OTP_TTL_MS });

  if (!usersByPhone.has(body.phoneNumber)) {
    createUser(body.phoneNumber, body.countryCode);
  }

  const response: OtpSendResponse = { requestId: `OTP-${randomUUID()}`, devOtp: otp };
  res.json(response);
});

authRouter.post("/otp/verify", (req, res) => {
  const body = req.body as Partial<OtpVerifyRequest>;
  if (!body.phoneNumber?.trim()) throw badRequest("phoneNumber is required");
  if (!body.otp?.trim()) throw badRequest("otp is required");

  const record = otpByPhone.get(body.phoneNumber);
  if (!record || record.otp !== body.otp || record.expiresAt < Date.now()) {
    throw unauthorized("Invalid or expired OTP");
  }
  otpByPhone.delete(body.phoneNumber);

  const user = usersByPhone.get(body.phoneNumber);
  if (!user) throw unauthorized("Unknown phone number — request an OTP first");

  const token = `TOKEN-${randomUUID()}`;
  tokens.set(token, user.userId);

  const response: OtpVerifyResponse = { token, user };
  res.json(response);
});
