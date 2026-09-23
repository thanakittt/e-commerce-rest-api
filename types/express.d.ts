import type { Request } from "express";
import type { UserRole } from "./db";

declare global {
  namespace Express {
    interface Request {
      userId: number;
      userRole: UserRole | string;
    }
  }
}

export interface AuthenticatedRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  userId: number;
  userRole: UserRole | string;
}
