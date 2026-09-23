import type { Request, Response, NextFunction } from "express";
import type { LoginInput, RegisterInput } from "../schemas/user.schema";
import type { ApiEnvelope, AuthTokenResponse } from "../types/api";
import type { AuthLoginRow, AuthRegisterRow } from "../types/db";
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
} as const;

const invalidCredentialsResponse = {
  success: false,
  message: "Invalid credentials",
} as const;

export async function register(
  req: Request<{}, ApiEnvelope<AuthRegisterRow>, RegisterInput>,
  res: Response<ApiEnvelope<AuthRegisterRow>>,
  next: NextFunction,
) {
  const { name, email, password, phone } = req.body;

  try {
    const hashedPassword = await Bun.password.hash(password);

    const [newUser] = await sql<AuthRegisterRow[]>`
      INSERT INTO users (name, email, password, phone)
      VALUES (${name}, ${email}, ${hashedPassword}, ${phone ?? null})
      RETURNING id, name, email, phone
    `;

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: newUser,
    });
  } catch (error) {
    if (error instanceof pg.PostgresError && error.code === "23505") {
      return res.status(409).json(userAlreadyExistsResponse);
    }

    next(error);
  }
}

export async function login(
  req: Request<{}, ApiEnvelope<AuthTokenResponse>, LoginInput>,
  res: Response<ApiEnvelope<AuthTokenResponse>>,
  next: NextFunction,
) {
  const { email, password } = req.body;

  try {
    const [user] = await sql<AuthLoginRow[]>`
      SELECT id, password, role FROM users WHERE email = ${email}
    `;

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
