import { Router } from "express";
import { createCart, getCartById } from "../controllers/cart.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { createCartSchema, getCartByIdSchema } from "../schemas/cart.schema";

const cartRouter = Router();

cartRouter.post("/", authenticate, validate(createCartSchema), createCart);

cartRouter.get("/:id", authenticate, validate(getCartByIdSchema), getCartById);

export default cartRouter;
