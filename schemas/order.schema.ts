import { z } from "zod";

const orderIdParam = z.coerce
  .number({ error: "Order ID is required" })
  .int({ error: "Order ID must be an integer" })
  .positive({ error: "Order ID must be a positive integer" });

const cancelReasonField = z
  .string({ error: "Reason must be a string" })
  .trim()
  .nonempty({ error: "Reason cannot be empty" })
  .nullish();

export const getOrderByIdSchema = z.object({
  params: z.object({
    id: orderIdParam,
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    id: orderIdParam,
  }),
  body: z.object({
    reason: cancelReasonField,
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    orderId: orderIdParam,
  }),
  body: z.object({
    status: z.enum(["pending", "paid", "shipped", "cancelled"], {
      error: "Invalid status. Allowed values: pending, paid, shipped, cancelled",
    }),
    cancellationReason: z
      .string({ error: "Cancellation reason must be a string" })
      .trim()
      .nonempty({ error: "Cancellation reason cannot be empty" })
      .nullish(),
  }),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>["body"];
export type UpdateOrderStatusInput = z.infer<
  typeof updateOrderStatusSchema
>["body"];
