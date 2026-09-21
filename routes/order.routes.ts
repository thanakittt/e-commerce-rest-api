import { Router } from "express";
import * as OrderController from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { cancelOrderSchema, getOrderByIdSchema } from "../schemas/order.schema";

const orderRouter = Router();

orderRouter.get("/", authenticate, OrderController.getOrdersByUserId);
orderRouter.get(
  "/:id",
  authenticate,
  validate(getOrderByIdSchema),
  OrderController.getOrderById,
);

orderRouter.patch(
  "/:id/cancel",
  authenticate,
  validate(cancelOrderSchema),
  OrderController.cancelOrder,
);

export default orderRouter;
export { default as adminOrderRouter } from "./admin.order.routes";
