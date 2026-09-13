import { Router } from "express";
import * as UserController from "../controllers/user.controller";
import { authenticate, authorizeRoles } from "../middlewares/auth.middleware";

const userRoutes = Router();

userRoutes.get(
  "/",
  authenticate,
  authorizeRoles(["admin"]),
  UserController.getAllUsers,
);

export default userRoutes;
