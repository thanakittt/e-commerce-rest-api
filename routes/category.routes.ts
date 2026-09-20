import { Router } from "express";
import {
  createCategory,
  getAllCategories,
} from "../controllers/category.controller";
import { validate } from "../middlewares/validate.middleware";
import { createCategorySchema } from "../schemas/category.schema";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const categoryRouter = Router();

categoryRouter.get("/", getAllCategories);

categoryRouter.post(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  validate(createCategorySchema),
  createCategory,
);

export default categoryRouter;
