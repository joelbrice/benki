import type { NextFunction, Request, Response } from "express";
import type { UserProfile } from "@benki/shared";
import { requireUserByToken } from "../store";
import { unauthorized } from "../errors";

export interface AuthedRequest extends Request {
  user?: UserProfile;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  try {
    req.user = requireUserByToken(token);
    next();
  } catch {
    next(unauthorized());
  }
}
