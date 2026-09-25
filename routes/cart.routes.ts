import { Router } from "express";
import * as CartController from "../controllers/cart.controller";
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

cartRouter.post(
  "/",
  authenticate,
  validate(createCartSchema),
  CartController.addToCart,
);

cartRouter.get(
  "/:id",
  authenticate,
  validate(getCartByIdSchema),
  CartController.getCartById,
);

cartRouter.delete(
  "/:id",
  authenticate,
  validate(deleteCartByIdSchema),
  CartController.deleteCartById,
);

cartRouter.delete(
  "/:cartId/items/:productId",
  authenticate,
  validate(deleteCartItemSchema),
  CartController.deleteCartItem,
);

cartRouter.put(
  "/:cartId/items/:productId",
  authenticate,
  validate(updateCartItemSchema),
  CartController.updateCartItem,
);

cartRouter.post(
  "/:id/checkout",
  authenticate,
  validate(checkoutSchema),
  CartController.checkout,
);

export default cartRouter;

