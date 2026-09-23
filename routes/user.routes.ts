import { Router } from "express";
import * as UserController from "../controllers/user.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  updateUserProfileSchema,
  updateUserRoleSchema,
  updateUserSchema,
  getUserByIdSchema,
} from "../schemas/user.schema";

const userRoutes = Router();

userRoutes.get(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  UserController.getAllUsers,
);

userRoutes.get("/profile", authenticate, UserController.getUserProfile);
userRoutes.put(
  "/profile",
  authenticate,
  validate(updateUserProfileSchema),
  UserController.updateUserProfile,
);

userRoutes.get(
  "/:id",
  authenticate,
  validate(getUserByIdSchema),
  UserController.getUserById,
);

userRoutes.put(
  "/:id",
  authenticate,
  validate(updateUserSchema),
  UserController.updateUserById,
);

userRoutes.patch(
  "/:id/role",
  authenticate,
  authorizeRoles(["admin"]),
  validate(updateUserRoleSchema),
  UserController.updateUserRole,
);

export default userRoutes;
