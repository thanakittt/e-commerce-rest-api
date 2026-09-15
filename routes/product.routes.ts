import { Router } from "express";
import {
  createProduct,
  updateProduct,
} from "../controllers/product.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  createProductSchema,
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

export default productRouter;

