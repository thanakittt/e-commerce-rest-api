import { z } from "zod";

const productId = z.coerce
  .number({ error: "Invalid product ID" })
  .int({ message: "Product ID must be an integer" })
  .positive({ message: "Product ID must be a positive integer" });

const name = z
  .string({ error: "Name is required" })
  .trim()
  .nonempty({ error: "Name cannot be empty" });

const description = z
  .string()
  .trim()
  .nonempty({ error: "Description cannot be empty" })
  .nullish();

const price = z
  .number({ error: "Price is required" })
  .positive({ error: "Price must be a positive number" });

const stock = z
  .number({ error: "Stock is required" })
  .int({ error: "Stock must be an integer" })
  .nonnegative({ error: "Stock cannot be negative" });

const categoryId = z
  .number({ error: "Category ID must be a number" })
  .int({ error: "Category ID must be an integer" })
  .positive({ error: "Category ID must be a positive integer" })
  .nullish();

const categoryIdQuery = z.coerce
  .number({ error: "Category ID must be a number" })
  .int({ error: "Category ID must be an integer" })
  .positive({ error: "Category ID must be a positive integer" })
  .optional();

export const getProductByIdSchema = z.object({
  params: z.object({
    id: productId,
  }),
});

const productBaseSchema = z
  .object({
    name,
    description,
    price,
    stock,
    categoryId,
  })
  .strict();

export const getAllProductsSchema = z.object({
  query: z.object({ categoryId: categoryIdQuery }).optional(),
});

export const createProductSchema = z.object({
  body: productBaseSchema,
});

export const updateProductSchema = z.object({
  params: z.object({ id: productId }),
  body: productBaseSchema,
});

export const deleteProductSchema = getProductByIdSchema;

export type GetProductByIdInput = z.infer<
  typeof getProductByIdSchema
>["params"];
export type GetAllProductsInput = z.infer<typeof getAllProductsSchema>["query"];
export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
export type UpdateProductInput = z.infer<typeof updateProductSchema>["body"];
export type DeleteProductInput = z.infer<typeof deleteProductSchema>["params"];
