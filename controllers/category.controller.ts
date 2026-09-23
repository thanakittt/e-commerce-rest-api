import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/express";
import type { ApiEnvelope, CategoryResponse } from "../types/api";
import type { CategoryRow } from "../types/db";
import type { CreateCategoryInput } from "../schemas/category.schema";
import sql from "../db";
import pg from "postgres";

const PG_UNIQUE_VIOLATION = "23505";

export async function getAllCategories(
  _req: Request<{}, ApiEnvelope<CategoryResponse[]>>,
  res: Response<ApiEnvelope<CategoryResponse[]>>,
  next: NextFunction,
) {
  try {
    const categories = await sql<CategoryRow[]>`
      SELECT id, name FROM categories ORDER BY id ASC
    `;

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategory(
  req: AuthenticatedRequest<{}, ApiEnvelope<CategoryResponse>, CreateCategoryInput>,
  res: Response<ApiEnvelope<CategoryResponse>>,
  next: NextFunction,
) {
  const { name } = req.body;

  try {
    const [newCategory] = await sql<CategoryRow[]>`
      INSERT INTO categories (name)
      VALUES (${name})
      RETURNING id, name
    `;

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: newCategory,
    });
  } catch (error) {
    if (
      error instanceof pg.PostgresError &&
      error.code === PG_UNIQUE_VIOLATION
    ) {
      return res.status(409).json({
        success: false,
        message: "Category already exists",
      });
    }

    next(error);
  }
}
