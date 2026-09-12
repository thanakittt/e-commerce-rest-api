import { z } from "zod";

const userBaseSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .nonempty({ error: "Name cannot be empty" }),
  email: z.email({ error: "Invalid email address" }).toLowerCase(),
  password: z
    .string({ error: "Password is required" })
    .min(8, { error: "Password must be at least 8 characters long" }),
});

export const registerSchema = z.object({
  body: userBaseSchema,
});

export const loginSchema = z.object({
  body: userBaseSchema.omit({ name: true }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
