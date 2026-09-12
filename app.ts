import express from "express";
import authRoutes from "./routes/auth.routes";
import { errorHandler } from "./middlewares/error.middleware";

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to the E-Commerce REST API",
  });
});

app.use(errorHandler);

export default app;
