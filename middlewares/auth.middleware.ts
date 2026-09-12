import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: number;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "[JWT] Missing required environment variable: JWT_SECRET. Please check your .env file.",
  );
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authorization token missing or invalid",
    });
  }

  const token = authHeader.split(" ")[1] as string;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
    };

    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
