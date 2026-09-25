import { Router } from "express";
import * as ProductController from "../controllers/product.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
  deleteProductSchema,
  getAllProductsSchema,
  getProductByIdSchema,
  updateProductSchema,
} from "../schemas/product.schema";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const productRouter = Router();

productRouter.get(
  "/",
  validate(getAllProductsSchema),
  ProductController.getAllProducts,
);
productRouter.get(
  "/:id",
  validate(getProductByIdSchema),
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
  validate(deleteProductSchema),
  ProductController.deleteProduct,
);

export default productRouter;
