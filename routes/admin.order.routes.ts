import { Router } from "express";
import * as OrderController from "../controllers/order.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateOrderStatusSchema } from "../schemas/order.schema";

const adminOrderRouter = Router();

adminOrderRouter.get(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  OrderController.getAllOrders,
);

adminOrderRouter.patch(
  "/:orderId/status",
  authenticate,
  authorizeRoles(["admin"]),
  validate(updateOrderStatusSchema),
  OrderController.updateOrderStatus,
);

export default adminOrderRouter;
