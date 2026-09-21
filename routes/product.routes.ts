import { Router } from "express";
import * as ProductController from "../controllers/product.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
  productIdSchema,
  updateProductSchema,
  getProductsQuerySchema,
} from "../schemas/product.schema";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const productRouter = Router();

productRouter.get(
  "/",
  validate(getProductsQuerySchema),
  ProductController.getAllProducts,
);
productRouter.get(
  "/:id",
  validate(productIdSchema),
  ProductController.getProductById,
);

productRouter.post(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  validate(createProductSchema),
  ProductController.createProduct,
);

productRouter.put(
  "/:id",
  authenticate,
  authorizeRoles(["admin"]),
  validate(updateProductSchema),
  ProductController.updateProduct,
);

productRouter.delete(
  "/:id",
  authenticate,
  authorizeRoles(["admin"]),
  validate(productIdSchema),
  ProductController.deleteProduct,
);

export default productRouter;
