import { z } from "zod";

const userId = z.coerce
  .number({ error: "Invalid user ID" })
  .int({ message: "User ID must be an integer" })
  .positive({ message: "User ID must be a positive integer" });

const name = z
  .string({ error: "Name is required" })
  .trim()
  .nonempty({ error: "Name cannot be empty" });

const email = z.email({ error: "Invalid email address" }).toLowerCase();

const password = z
  .string({ error: "Password is required" })
  .min(8, { error: "Password must be at least 8 characters long" });

const phone = z
  .string()
  .trim()
  .regex(/^0\d{9}$/, { error: "Invalid phone number format" })
  .nullish();

const role = z.enum(["user", "admin"], {
  error: "Invalid role. Allowed values: user, admin",
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: userId,
  }),
});

export const registerSchema = z.object({
  body: z
    .object({
      name,
      email,
      password,
      phone,
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email,
      password,
    })
    .strict(),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: userId,
  }),
  body: z
    .object({
      name,
      email,
      phone,
    })
    .strict(),
});

export const updateUserProfileSchema = z.object({
  body: z
    .object({
      name,
      email,
      phone,
    })
    .strict(),
});

export const updateUserRoleSchema = z.object({
  params: z.object({
    id: userId,
  }),
  body: z
    .object({
      role,
    })
    .strict(),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];

export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>["params"];
export type UpdateUserInput = z.infer<typeof updateUserSchema>["body"];
export type UpdateUserParamsInput = z.infer<typeof updateUserSchema>["params"];
export type UpdateUserProfileInput = z.infer<
  typeof updateUserProfileSchema
>["body"];
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>["body"];
export type UpdateUserRoleParamsInput = z.infer<typeof updateUserRoleSchema>["params"];
