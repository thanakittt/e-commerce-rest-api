import { Router } from "express";
import * as UserController from "../controllers/user.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { updateUserSchema, userIdSchema } from "../schemas/auth.schema";

const userRoutes = Router();

userRoutes.get(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  UserController.getAllUsers,
);

userRoutes.get("/profile", authenticate, UserController.getUserProfile);

userRoutes.get(
  "/:id",
  authenticate,
  authorizeRoles(["admin", "user"]),
  validate(userIdSchema),
  UserController.getUserById,
);

userRoutes.put(
  "/:id",
  authenticate,
  authorizeRoles(["admin", "user"]),
  validate(updateUserSchema),
  UserController.updateUserById,
);

export default userRoutes;
