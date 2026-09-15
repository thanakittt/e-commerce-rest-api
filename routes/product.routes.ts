import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  updateProduct,
} from "../controllers/product.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
  productIdSchema,
  updateProductSchema,
} from "../schemas/product.schema";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const productRouter = Router();

productRouter.post(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  validate(createProductSchema),
  createProduct,
);

productRouter.put(
  "/:id",
  authenticate,
  authorizeRoles(["admin"]),
  validate(updateProductSchema),
  updateProduct,
);

productRouter.delete(
  "/:id",
  authenticate,
  authorizeRoles(["admin"]),
  validate(productIdSchema),
  deleteProduct,
);

export default productRouter;

