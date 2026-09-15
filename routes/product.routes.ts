import { Router } from "express";
import { createProduct } from "../controllers/product.controller";
import { validate } from "../middlewares/validate.middleware";
import { createProductSchema } from "../schemas/product.schema";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const productRouter = Router();

productRouter.post(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  validate(createProductSchema),
  createProduct,
);

export default productRouter;
