import { Router } from "express";
import {
  createCart,
  deleteCartById,
  getCartById,
} from "../controllers/cart.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createCartSchema,
  deleteCartByIdSchema,
  getCartByIdSchema,
} from "../schemas/cart.schema";

const cartRouter = Router();

cartRouter.post("/", authenticate, validate(createCartSchema), createCart);

cartRouter.get("/:id", authenticate, validate(getCartByIdSchema), getCartById);

cartRouter.delete(
  "/:id",
  authenticate,
  validate(deleteCartByIdSchema),
  deleteCartById,
);

export default cartRouter;
