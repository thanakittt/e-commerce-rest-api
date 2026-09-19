import { Router } from "express";
import { getOrdersByUserId } from "../controllers/order.controller";
import { authenticate } from "../middlewares/auth.middleware";

const orderRouter = Router();

orderRouter.get("/", authenticate, getOrdersByUserId);

export default orderRouter;
