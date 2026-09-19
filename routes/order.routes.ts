import { Router } from "express";
import { getOrdersByUserId } from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { getOrderById } from "../controllers/order.controller";
import { validate } from "../middlewares/validate.middleware";
import { getOrderByIdSchema } from "../schemas/order.schema";

const orderRouter = Router();

orderRouter.get("/", authenticate, getOrdersByUserId);
orderRouter.get(
  "/:id",
  authenticate,
  validate(getOrderByIdSchema),
  getOrderById,
);

export default orderRouter;
