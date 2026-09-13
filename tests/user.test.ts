import { describe, expect, beforeEach, afterEach, it, spyOn, mock } from "bun:test";
import request from "supertest";
import app from "../app";
import sql, * as db from "../db";
import jwt from "jsonwebtoken";

type UserRole = "admin" | "user";

const generateToken = (payload?: { id?: number; role?: UserRole }) => {
  return jwt.sign(
    {
      userId: payload?.id ?? 1,
      userRole: payload?.role ?? "admin",
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "1d" },
  );
};

const sendGetUsersRequest = (token?: string) => {
  const req = request(app).get("/api/users");
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

describe("GET /api/users", () => {
  beforeEach(async () => {
    await sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`;
  });

  afterEach(() => {
    mock.restore();
  });

  it("should return 200 and a list of users when records exist", async () => {
    // Arrange
    const mockUsers: {
      name: string;
      email: string;
      phone: string;
      role: UserRole;
    }[] = [
      {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "0812345677",
        role: "admin",
      },
      {
        name: "Jane Doe",
        email: "jane.doe@example.com",
        phone: "0812345678",
        role: "user",
      },
    ];

    await sql`INSERT INTO users ${sql(
      mockUsers.map((user) => ({ ...user, password: "password123" })),
    )}`;

    const token = generateToken();

    // Act
    const res = await sendGetUsersRequest(token);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({
      success: true,
      message: "Users fetched successfully",
      data: [
        { id: 1, ...mockUsers[0] },
        { id: 2, ...mockUsers[1] },
      ],
    });
  });

  it("should return 200 and an empty list when no records exist", async () => {
    // Arrange
    const token = generateToken();

    // Act
    const res = await sendGetUsersRequest(token);

    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toStrictEqual({
      success: true,
      message: "Users fetched successfully",
      data: [],
    });
  });

  it("should return 401 when user is not authenticated", async () => {
    // Act
    const res = await sendGetUsersRequest();

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Unauthorized",
    });
  });

  it("should return 401 when token is invalid", async () => {
    // Arrange
    const invalidToken = "invalid_token";

    // Act
    const res = await sendGetUsersRequest(invalidToken);

    // Assert
    expect(res.status).toBe(401);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Unauthorized",
    });
  });

  it("should return 403 when user is not an admin", async () => {
    // Arrange
    const token = generateToken({ role: "user" });

    // Act
    const res = await sendGetUsersRequest(token);

    // Assert
    expect(res.status).toBe(403);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Forbidden",
    });
  });

  it("should return 500 when database server is down", async () => {
    // Arrange
    spyOn(db, "default").mockRejectedValue(
      new Error("Simulated database error"),
    );
    spyOn(console, "error").mockImplementation(() => {});

    const token = generateToken();

    // Act
    const res = await sendGetUsersRequest(token);

    // Assert
    expect(res.status).toBe(500);
    expect(res.body).toStrictEqual({
      success: false,
      message: "Internal server error",
    });
  });
});
