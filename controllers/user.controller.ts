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
