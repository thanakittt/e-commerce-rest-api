import type { Request, Response, NextFunction } from "express";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema";
import sql from "../db";
import pg from "postgres";
import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET) {
  throw new Error(
    "[JWT] Missing required environment variable: JWT_SECRET. Please check your .env file.",
  );
}

const JWT_SECRET = process.env.JWT_SECRET;

const userAlreadyExistsResponse = {
  success: false,
  message: "User already exists",
};

const invalidCredentialsResponse = {
  success: false,
  message: "Invalid credentials",
};

export async function register(
  req: Request<{}, {}, RegisterInput>,
  res: Response,
  next: NextFunction,
) {
  const { name, email, password, phone } = req.body;

  try {
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email} ${
        phone ? sql`OR phone = ${phone}` : sql``
      }
    `;

    if (existingUser.count > 0) {
      return res.status(409).json(userAlreadyExistsResponse);
    }

    const hashedPassword = await Bun.password.hash(password);

    const newUser = await sql`
      INSERT INTO users (name, email, password, phone) VALUES (${name}, ${email}, ${hashedPassword}, ${phone ?? null}) RETURNING id, name, email, phone
    `;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser[0],
    });
  } catch (error) {
    if (error instanceof pg.PostgresError && error.code === "23505") {
      return res.status(409).json(userAlreadyExistsResponse);
    }

    next(error);
  }
}

export async function login(
  req: Request<{}, {}, LoginInput>,
  res: Response,
  next: NextFunction,
) {
  const { email, password } = req.body;

  try {
    const [user] =
      await sql`SELECT id, password, role FROM users WHERE email = ${email}`;

    if (!user) {
      return res.status(401).json(invalidCredentialsResponse);
    }

    const isMatch = await Bun.password.verify(password, user.password);

    if (!isMatch) {
      return res.status(401).json(invalidCredentialsResponse);
    }

    const token = jwt.sign(
      {
        userId: user.id,
        userRole: user.role,
      },
      JWT_SECRET,
      { expiresIn: "1d" },
    );

    return res.json({
      success: true,
      message: "User logged in successfully",
      data: {
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}
