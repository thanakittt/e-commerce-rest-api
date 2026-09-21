import { Router } from "express";
import * as AuthController from "../controllers/auth.controller";
import { validate } from "../middlewares/validate.middleware";
import { loginSchema, registerSchema } from "../schemas/user.schema";

const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), AuthController.register);

authRoutes.post("/login", validate(loginSchema), AuthController.login);

export default authRoutes;
