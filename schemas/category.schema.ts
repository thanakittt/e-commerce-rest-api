import { z } from "zod";

export const categoryBaseSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .trim()
      .nonempty({ error: "Name cannot be empty" }),
  })
  .strict();

export const createCategorySchema = z.object({
  body: categoryBaseSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
