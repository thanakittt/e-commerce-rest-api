import { z } from "zod";

// --- Base Field Schemas ---
const productIdField = z
  .number({ error: "Product ID is required" })
  .int({ error: "Product ID must be an integer" })
  .positive({ error: "Product ID must be a positive integer" });

const quantityField = z
  .number({ error: "Quantity is required" })
  .int({ error: "Quantity must be an integer" })
  .positive({ error: "Quantity must be a positive integer" });

const cartIdParam = z.coerce
  .number({ error: "Cart ID is required" })
  .int({ error: "Cart ID must be an integer" })
  .positive({ error: "Cart ID must be a positive integer" });

const productIdParam = z.coerce
  .number({ error: "Product ID is required" })
  .int({ error: "Product ID must be an integer" })
  .positive({ error: "Product ID must be a positive integer" });

// --- Request Schemas ---
export const addToCartSchema = z.object({
  productId: productIdField,
  quantity: quantityField,
});

export const createCartSchema = z.object({
  body: addToCartSchema,
});

export const getCartByIdSchema = z.object({
  params: z.object({
    id: cartIdParam,
  }),
});

export const deleteCartByIdSchema = getCartByIdSchema;

export const deleteCartItemSchema = z.object({
  params: z.object({
    cartId: cartIdParam,
    productId: productIdParam,
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: quantityField,
  }),
  params: z.object({
    cartId: cartIdParam,
    productId: productIdParam,
  }),
});

// --- Inferred Types ---
export type CreateCartInput = z.infer<typeof createCartSchema>["body"];
export type GetCartByIdInput = z.infer<typeof getCartByIdSchema>["params"];
export type DeleteCartByIdInput = z.infer<
  typeof deleteCartByIdSchema
>["params"];
export type DeleteCartItemInput = z.infer<
  typeof deleteCartItemSchema
>["params"];
