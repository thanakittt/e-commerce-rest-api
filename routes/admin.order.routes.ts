import { Router } from "express";
import {
  getAllOrders,
  updateOrderStatus,
} from "../controllers/order.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateOrderStatusSchema } from "../schemas/order.schema";

const adminOrderRouter = Router();

adminOrderRouter.get(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  getAllOrders,
);

adminOrderRouter.patch(
  "/:orderId/status",
  authenticate,
  authorizeRoles(["admin"]),
  validate(updateOrderStatusSchema),
  updateOrderStatus,
);

export default adminOrderRouter;
