import { z } from "zod";

// --- Base Field Schemas ---
const productId = z
  .number({ error: "Product ID is required" })
  .int({ error: "Product ID must be an integer" })
  .positive({ error: "Product ID must be a positive integer" });

const quantity = z
  .number({ error: "Quantity is required" })
  .int({ error: "Quantity must be an integer" })
  .positive({ error: "Quantity must be a positive integer" });

const cartId = z
  .number({ error: "Cart ID is required" })
  .int({ error: "Cart ID must be an integer" })
  .positive({ error: "Cart ID must be a positive integer" });

const cartIdParam = z.coerce
  .number({ error: "Cart ID is required" })
  .int({ error: "Cart ID must be an integer" })
  .positive({ error: "Cart ID must be a positive integer" });

const productIdParam = z.coerce
  .number({ error: "Product ID is required" })
  .int({ error: "Product ID must be an integer" })
  .positive({ error: "Product ID must be a positive integer" });

const shippingAddress = z
  .string({ error: "Shipping address is required" })
  .trim()
  .nonempty({ error: "Shipping address cannot be empty" });

const paymentMethod = z.enum(["credit_card", "paypal", "bank_transfer"], {
  error: "Payment method must be one of: credit_card, paypal, bank_transfer",
});

// --- Request Schemas ---
export const addToCartSchema = z.object({
  body: z
    .object({
      productId,
      quantity,
    })
    .strict(),
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
  body: z
    .object({
      quantity,
    })
    .strict(),
  params: z.object({
    cartId: cartIdParam,
    productId: productIdParam,
  }),
});

export const checkoutSchema = z.object({
  body: z
    .object({
      shippingAddress,
      paymentMethod,
    })
    .strict(),
  params: z.object({
    id: cartIdParam,
  }),
});

// --- Inferred Types ---
export type AddToCartInput = z.infer<typeof addToCartSchema>["body"];
export type GetCartByIdInput = z.infer<typeof getCartByIdSchema>["params"];
export type DeleteCartByIdInput = z.infer<
  typeof deleteCartByIdSchema
>["params"];
export type DeleteCartItemInput = z.infer<
  typeof deleteCartItemSchema
>["params"];
export type CheckoutBodyInput = z.infer<typeof checkoutSchema>["body"];
export type CheckoutParamsInput = z.infer<typeof checkoutSchema>["params"];
export type UpdateCartItemBodyInput = z.infer<
  typeof updateCartItemSchema
>["body"];
export type UpdateCartItemParamsInput = z.infer<
  typeof updateCartItemSchema
>["params"];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
