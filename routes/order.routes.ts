import { Router } from "express";
import {
  cancelOrder,
  getOrderById,
  getOrdersByUserId,
} from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { cancelOrderSchema, getOrderByIdSchema } from "../schemas/order.schema";

const orderRouter = Router();

orderRouter.get("/", authenticate, getOrdersByUserId);
orderRouter.get(
  "/:id",
  authenticate,
  validate(getOrderByIdSchema),
  getOrderById,
);

orderRouter.patch(
  "/:id/cancel",
  authenticate,
  validate(cancelOrderSchema),
  cancelOrder,
);

export default orderRouter;
