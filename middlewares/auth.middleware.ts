import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error(
    "[JWT] Missing required environment variable: JWT_SECRET. Please check your .env file.",
  );
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const token = authHeader.split(" ")[1] as string;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: number;
      userRole: string;
    };

    req.userId = decoded.userId;
    req.userRole = decoded.userRole;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
};

export const authorizeRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }
    next();
  };
};
