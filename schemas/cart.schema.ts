import { z } from "zod";

export const addToCartSchema = z.object({
  productId: z
    .number({ error: "Product ID is required" })
    .int({ error: "Product ID must be an integer" })
    .positive({ error: "Product ID must be a positive integer" }),
  quantity: z
    .number({ error: "Quantity is required" })
    .int({ error: "Quantity must be an integer" })
    .positive({ error: "Quantity must be a positive integer" }),
});

export const createCartSchema = z.object({
  body: addToCartSchema,
});

export type CreateCartInput = z.infer<typeof createCartSchema>["body"];

export const getCartByIdSchema = z.object({
  params: z.object({
    id: z.coerce
      .number({ error: "Cart ID is required" })
      .int({ error: "Cart ID must be an integer" })
      .positive({ error: "Cart ID must be a positive integer" }),
  }),
});

export type GetCartByIdInput = z.infer<typeof getCartByIdSchema>["params"];

export const deleteCartByIdSchema = getCartByIdSchema;

export type DeleteCartByIdInput = z.infer<
  typeof deleteCartByIdSchema
>["params"];

export const deleteCartItemSchema = z.object({
  params: z.object({
    cartId: z.coerce
      .number({ error: "Cart ID is required" })
      .int({ error: "Cart ID must be an integer" })
      .positive({ error: "Cart ID must be a positive integer" }),
    productId: z.coerce
      .number({ error: "Product ID is required" })
      .int({ error: "Product ID must be an integer" })
      .positive({ error: "Product ID must be a positive integer" }),
  }),
});

export type DeleteCartItemInput = z.infer<
  typeof deleteCartItemSchema
>["params"];
