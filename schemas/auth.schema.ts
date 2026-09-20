import { z } from "zod";

export const userIdSchema = z.object({
  params: z.object({
    id: z.coerce
      .number({ error: "Invalid user ID" })
      .int({ message: "User ID must be an integer" })
      .positive({ message: "User ID must be a positive integer" }),
  }),
});

const userBaseSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .nonempty({ error: "Name cannot be empty" }),
  email: z.email({ error: "Invalid email address" }).toLowerCase(),
  password: z
    .string({ error: "Password is required" })
    .min(8, { error: "Password must be at least 8 characters long" }),
  phone: z.string().trim().optional(),
});

export const registerSchema = z.object({
  body: userBaseSchema,
});

export const loginSchema = z.object({
  body: userBaseSchema.omit({ name: true, phone: true }),
});

export const updateUserSchema = z.object({
  params: userIdSchema.shape.params,
  body: userBaseSchema
    .pick({
      name: true,
      email: true,
      phone: true,
    })
    .strict(),
});

export const updateUserProfileSchema = z.object({
  body: userBaseSchema
    .pick({
      name: true,
      email: true,
      phone: true,
    })
    .strict(),
});

export type UserIdInput = z.input<typeof userIdSchema>["params"];
export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>["body"];
