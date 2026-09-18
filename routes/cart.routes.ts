import { Router } from "express";
import {
  createCart,
  deleteCartById,
  deleteCartItem,
  getCartById,
  updateCartItem,
} from "../controllers/cart.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createCartSchema,
  deleteCartByIdSchema,
  deleteCartItemSchema,
  getCartByIdSchema,
  updateCartItemSchema,
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

cartRouter.put(
  "/:cartId/items/:productId",
  authenticate,
  validate(updateCartItemSchema),
  updateCartItem,
);

export default cartRouter;
