import { z } from "zod";

export const productIdSchema = z.object({
  params: z.object({
    id: z.coerce
      .number({ error: "Invalid product ID" })
      .int({ message: "Product ID must be an integer" })
      .positive({ message: "Product ID must be a positive integer" }),
  }),
});

const productBaseSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .trim()
      .nonempty({ error: "Name cannot be empty" }),
    description: z
      .string()
      .trim()
      .nonempty({ error: "Description cannot be empty" })
      .nullish(),
    price: z
      .number({ error: "Price is required" })
      .positive({ error: "Price must be a positive number" }),
    stock: z
      .number({ error: "Stock is required" })
      .int({ error: "Stock must be an integer" })
      .nonnegative({ error: "Stock cannot be negative" }),
    categoryId: z
      .number({ error: "Category ID must be a number" })
      .int({ error: "Category ID must be an integer" })
      .positive({ error: "Category ID must be a positive integer" })
      .nullish(),
  })
  .strict();

export const getProductsQuerySchema = z.object({
  query: z
    .object({
      categoryId: z.coerce
        .number({ error: "Category ID must be a number" })
        .int({ message: "Category ID must be an integer" })
        .positive({ message: "Category ID must be a positive integer" })
        .optional(),
    })
    .optional(),
});

export const createProductSchema = z.object({
  body: productBaseSchema,
});

export const updateProductSchema = z.object({
  params: productIdSchema.shape.params,
  body: productBaseSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
export type GetProductsQueryInput = z.infer<
  typeof getProductsQuerySchema
>["query"];
export type ProductIdInput = z.infer<typeof productIdSchema>["params"];
export type ProductParamsInput = z.infer<typeof productIdSchema>["params"];
export type UpdateProductBodyInput = z.infer<typeof updateProductSchema>["body"];
export type UpdateProductParamsInput = z.infer<typeof updateProductSchema>["params"];
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
