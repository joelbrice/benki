import type { SessionRow, StaffRow, UserRow } from "../db/rows";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId: string;
      rawBody?: Buffer;
      user?: UserRow;
      session?: SessionRow;
      staff?: StaffRow;
    }
  }
}

export {};
