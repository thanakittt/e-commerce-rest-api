import express from "express";
import authRoutes from "./routes/auth.routes";
import { errorHandler } from "./middlewares/error.middleware";
import userRoutes from "./routes/user.routes";
import productRouter from "./routes/product.routes";
import cartRouter from "./routes/cart.routes";

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRouter);
app.use("/api/carts", cartRouter);

app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to the E-Commerce REST API",
  });
});

app.use(errorHandler);

export default app;
