import { z } from "zod";

export const getOrderByIdSchema = z.object({
  params: z.object({
    id: z.coerce
      .number({ error: "Order ID is required" })
      .int({ error: "Order ID must be an integer" })
      .positive({ error: "Order ID must be a positive integer" }),
  }),
});
