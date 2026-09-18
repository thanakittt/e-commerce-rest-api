import { Router } from "express";
import {
  checkout,
  createCart,
  deleteCartById,
  deleteCartItem,
  getCartById,
  updateCartItem,
} from "../controllers/cart.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  checkoutSchema,
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

cartRouter.post(
  "/:id/checkout",
  authenticate,
  validate(checkoutSchema),
  checkout,
);

export default cartRouter;

