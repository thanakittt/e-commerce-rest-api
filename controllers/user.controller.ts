import type { NextFunction, Request, Response } from "express";
import sql from "../db";
import pg from "postgres";
import type { UpdateUserRoleInput } from "../schemas/auth.schema";

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

export async function updateUserById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const idToUpdate = Number(req.params.id);
    const { name, email, phone } = req.body;
    const isOwner = req.userId === idToUpdate;
    const isAdmin = req.userRole === "admin";
    const hasPermission = isOwner || isAdmin;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const [user] = await sql`
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
    if (error instanceof pg.PostgresError && error.code === "23505") {
      const constraint = (
        error.constraint_name ??
        error.detail ??
        ""
      ).toLowerCase();

      if (constraint.includes("email")) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }

      if (constraint.includes("phone")) {
        return res.status(409).json({
          success: false,
          message: "Phone already exists",
        });
      }
    }

    next(error);
  }
}

export async function getUserProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = Number(req.userId);

    const [user] = await sql<
      [
        {
          id: number;
          name: string;
          email: string;
          phone: string | null;
          role: string;
        },
      ]
    >`SELECT id, name, email, phone, role FROM users WHERE id = ${userId}`;

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
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = Number(req.userId);
    const { name, email, phone } = req.body;

    const [user] = await sql<
      [
        {
          id: number;
          name: string;
          email: string;
          phone: string | null;
          role: string;
        },
      ]
    >`
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
    if (error instanceof pg.PostgresError && error.code === "23505") {
      const constraint = (
        error.constraint_name ??
        error.detail ??
        ""
      ).toLowerCase();

      if (constraint.includes("email")) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }

      if (constraint.includes("phone")) {
        return res.status(409).json({
          success: false,
          message: "Phone already exists",
        });
      }
    }

    next(error);
  }
}

export async function updateUserRole(
  req: Request<{ userId: string }, {}, UpdateUserRoleInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = Number(req.params.userId);
    const { role } = req.body;

    const [user] = await sql<
      [
        {
          id: number;
          role: string;
        },
      ]
    >`
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
