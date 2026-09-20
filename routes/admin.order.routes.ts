import { Router } from "express";
import { getAllOrders } from "../controllers/order.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const adminOrderRouter = Router();

adminOrderRouter.get(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  getAllOrders,
);

export default adminOrderRouter;
