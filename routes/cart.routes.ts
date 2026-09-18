import { Router } from "express";
import {
  createCart,
  deleteCartById,
  deleteCartItem,
  getCartById,
} from "../controllers/cart.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createCartSchema,
  deleteCartByIdSchema,
  deleteCartItemSchema,
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

cartRouter.delete(
  "/:cartId/items/:productId",
  authenticate,
  validate(deleteCartItemSchema),
  deleteCartItem,
);

export default cartRouter;
