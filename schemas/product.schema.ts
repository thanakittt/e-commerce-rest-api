import { z } from "zod";

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

export const createProductSchema = z.object({
  body: productBaseSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>["body"];
