import type { Request, RequestHandler } from "express";
import type { StaffRole } from "@benki/shared";
import type { AppContext } from "../context";
import { badRequest, forbidden, unauthorized } from "../lib/errors";
import { authenticate } from "../services/auth";
import { authenticateStaff } from "../services/staff";
import "./types";

export function bearerToken(req: Request): string | undefined {
  const header = req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
}

export function deviceIdOf(req: Request, required = false): string | undefined {
  const id = req.header("x-device-id");
  if (id === undefined) {
    if (required) throw badRequest("x-device-id header is required");
    return undefined;
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(id)) throw badRequest("x-device-id is malformed");
  return id;
}

export function requireUser(ctx: AppContext): RequestHandler {
  return (req, _res, next) => {
    try {
      const token = bearerToken(req);
      if (!token?.startsWith("bk_")) throw unauthorized();
      const { user, session } = authenticate(ctx, token, deviceIdOf(req));
      req.user = user;
      req.session = session;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireStaff(ctx: AppContext, ...roles: StaffRole[]): RequestHandler {
  return (req, _res, next) => {
    try {
      const token = bearerToken(req);
      if (!token?.startsWith("bks_")) throw unauthorized();
      const staff = authenticateStaff(ctx, token);
      if (roles.length && !roles.includes(staff.role)) throw forbidden(`Requires one of: ${roles.join(", ")}`);
      req.staff = staff;
      next();
    } catch (error) {
      next(error);
    }
  };
}
