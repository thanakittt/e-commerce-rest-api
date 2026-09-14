import type { NextFunction, Request, Response } from "express";
import sql from "../db";

export async function getAllUsers(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const users =
      await sql`SELECT id, name, email, phone, role FROM users ORDER BY id ASC`;

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUserById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const isOwner = req.userId === Number(req.params.id);
    const isAdmin = req.userRole === "admin";
    const hasPermission = isOwner || isAdmin;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const [user] =
      await sql`SELECT id, name, email, phone, role FROM users WHERE id = ${Number(req.params.id)}`;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}
