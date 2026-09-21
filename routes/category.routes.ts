import { Router } from "express";
import * as CategoryController from "../controllers/category.controller";
import { validate } from "../middlewares/validate.middleware";
import { createCategorySchema } from "../schemas/category.schema";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const categoryRouter = Router();

categoryRouter.get("/", CategoryController.getAllCategories);

categoryRouter.post(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  validate(createCategorySchema),
  CategoryController.createCategory,
);

export default categoryRouter;
