import type { NextFunction, Request, Response } from "express";
import sql from "../db";
import pg from "postgres";
import type { CreateProductInput } from "../schemas/product.schema";

const PG_FOREIGN_KEY_VIOLATION = "23503";

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: string;
  category_id: number | null;
  stock: number;
}

interface ProductResponse {
  id: number;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  categoryId: number | null;
}

function formatProductResponse(product: ProductRow): ProductResponse {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price).toFixed(2),
    stock: product.stock,
    categoryId: product.category_id,
  };
}

export async function getAllProducts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const categoryId = req.query.categoryId;
    const products =
      categoryId !== undefined
        ? await sql<ProductRow[]>`SELECT * FROM products WHERE category_id = ${categoryId as any}`
        : await sql<ProductRow[]>`SELECT * FROM products`;

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: products.map(formatProductResponse),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  const productId = Number(req.params.id);

  try {
    const [product] = await sql<[ProductRow?]>`
      SELECT * FROM products WHERE id = ${productId}
    `;

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: formatProductResponse(product),
    });
  } catch (error) {
    next(error);
  }
}

export async function createProduct(
  req: Request<{}, {}, CreateProductInput>,
  res: Response,
  next: NextFunction,
) {
  const {
    name,
    description = null,
    price,
    stock,
    categoryId = null,
  } = req.body;

  try {
    const [newProduct] = await sql<[ProductRow]>`
      INSERT INTO products (name, description, price, stock, category_id)
      VALUES (
        ${name},
        ${description},
        ${price},
        ${stock},
        ${categoryId}
      )
      RETURNING id, name, description, price, category_id, stock
    `;

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: formatProductResponse(newProduct),
    });
  } catch (error) {
    if (
      error instanceof pg.PostgresError &&
      error.code === PG_FOREIGN_KEY_VIOLATION
    ) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "categoryId",
            message: "Category not found",
          },
        ],
      });
    }

    next(error);
  }
}

export async function updateProduct(
  req: Request<{ id: string }, {}, CreateProductInput>,
  res: Response,
  next: NextFunction,
) {
  const productId = Number(req.params.id);
  const {
    name,
    description = null,
    price,
    stock,
    categoryId = null,
  } = req.body;

  try {
    const [updatedProduct] = await sql<[ProductRow]>`
      UPDATE products
      SET
        name = ${name},
        description = ${description},
        price = ${price},
        stock = ${stock},
        category_id = ${categoryId}
      WHERE id = ${productId}
      RETURNING id, name, description, price, category_id, stock
    `;

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: formatProductResponse(updatedProduct),
    });
  } catch (error) {
    if (
      error instanceof pg.PostgresError &&
      error.code === PG_FOREIGN_KEY_VIOLATION
    ) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "categoryId",
            message: "Category not found",
          },
        ],
      });
    }

    next(error);
  }
}

export async function deleteProduct(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  const productId = Number(req.params.id);

  try {
    const [deletedProduct] = await sql<[ProductRow?]>`
      DELETE FROM products
      WHERE id = ${productId}
      RETURNING id
    `;

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}
