import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getAllProducts,
  updateProduct,
} from "../controllers/product.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
  productIdSchema,
  updateProductSchema,
  getProductsQuerySchema,
} from "../schemas/product.schema";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const productRouter = Router();

productRouter.get("/", validate(getProductsQuerySchema), getAllProducts);

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
