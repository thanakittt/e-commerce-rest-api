import { Router } from "express";
import { createCart } from "../controllers/cart.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createCartSchema } from "../schemas/cart.schema";

const cartRouter = Router();

cartRouter.post("/", authenticate, validate(createCartSchema), createCart);

export default cartRouter;
