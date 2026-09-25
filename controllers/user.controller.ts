import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/express";
import type { ApiEnvelope, UserResponse, UserRoleResponse } from "../types/api";
import type { SafeUserRow, UserRoleRow } from "../types/db";
import type {
  UpdateUserInput,
  UpdateUserProfileInput,
  UpdateUserRoleInput,
} from "../schemas/user.schema";
import sql from "../db";
import pg from "postgres";

function isOwnerOrAdmin(
  req: Pick<AuthenticatedRequest, "userId" | "userRole">,
  targetUserId: number,
): boolean {
  return req.userId === targetUserId || req.userRole === "admin";
}

function handleUserDuplicateError(error: unknown, res: Response): boolean {
  if (error instanceof pg.PostgresError && error.code === "23505") {
    const constraint = (
      error.constraint_name ??
      error.detail ??
      ""
    ).toLowerCase();

    if (constraint.includes("email")) {
      res.status(409).json({
        success: false,
        message: "Email already exists",
      });
      return true;
    }

    if (constraint.includes("phone")) {
      res.status(409).json({
        success: false,
        message: "Phone already exists",
      });
      return true;
    }
  }

  return false;
}

export async function getAllUsers(
  _req: AuthenticatedRequest<{}, ApiEnvelope<UserResponse[]>>,
  res: Response<ApiEnvelope<UserResponse[]>>,
  next: NextFunction,
) {
  try {
    const users =
      await sql<SafeUserRow[]>`SELECT id, name, email, phone, role FROM users ORDER BY id ASC`;

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
  req: AuthenticatedRequest<{ id: string }, ApiEnvelope<UserResponse>>,
  res: Response<ApiEnvelope<UserResponse>>,
  next: NextFunction,
) {
  try {
    const targetUserId = Number(req.params.id);

    if (!isOwnerOrAdmin(req, targetUserId)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const [user] =
      await sql<SafeUserRow[]>`SELECT id, name, email, phone, role FROM users WHERE id = ${targetUserId}`;

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

export async function updateUserById(
  req: AuthenticatedRequest<{ id: string }, ApiEnvelope<UserResponse>, UpdateUserInput>,
  res: Response<ApiEnvelope<UserResponse>>,
  next: NextFunction,
) {
  try {
    const idToUpdate = Number(req.params.id);
    const { name, email, phone } = req.body;

    if (!isOwnerOrAdmin(req, idToUpdate)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const [user] = await sql<SafeUserRow[]>`
      UPDATE users 
      SET name = ${name}, email = ${email}, phone = ${phone ?? null} 
      WHERE id = ${idToUpdate} 
      RETURNING id, name, email, phone, role;
    `;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    if (handleUserDuplicateError(error, res)) return;

    next(error);
  }
}

export async function getUserProfile(
  req: AuthenticatedRequest<{}, ApiEnvelope<UserResponse>>,
  res: Response<ApiEnvelope<UserResponse>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;

    const [user] = await sql<SafeUserRow[]>`
      SELECT id, name, email, phone, role FROM users WHERE id = ${userId}
    `;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User profile fetched successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateUserProfile(
  req: AuthenticatedRequest<{}, ApiEnvelope<UserResponse>, UpdateUserProfileInput>,
  res: Response<ApiEnvelope<UserResponse>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const { name, email, phone } = req.body;

    const [user] = await sql<SafeUserRow[]>`
      UPDATE users 
      SET name = ${name}, email = ${email}, phone = ${phone ?? null} 
      WHERE id = ${userId} 
      RETURNING id, name, email, phone, role;
    `;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      data: user,
    });
  } catch (error) {
    if (handleUserDuplicateError(error, res)) return;

    next(error);
  }
}

export async function updateUserRole(
  req: AuthenticatedRequest<{ id: string }, ApiEnvelope<UserRoleResponse>, UpdateUserRoleInput>,
  res: Response<ApiEnvelope<UserRoleResponse>>,
  next: NextFunction,
) {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body;

    const [user] = await sql<UserRoleRow[]>`
      UPDATE users 
      SET role = ${role} 
      WHERE id = ${userId} 
      RETURNING id, role;
    `;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User role updated successfully",
      data: user,
    });
  } catch (error) {
    next(error);
  }
}
