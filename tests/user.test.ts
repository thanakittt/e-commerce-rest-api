import {
  describe,
  expect,
  beforeEach,
  afterEach,
  it,
  spyOn,
  mock,
} from "bun:test";
import request from "supertest";
import app from "../app";
import sql, * as db from "../db";
import jwt from "jsonwebtoken";

type UserRole = "admin" | "user";

interface TestUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

const defaultUserData = {
  name: "John Doe",
  email: "john.doe@example.com",
  phone: "0812345678",
  role: "user" as UserRole,
  password: "password123",
};

const insertTestUser = async (
  overrides: Partial<typeof defaultUserData> = {},
): Promise<TestUser> => {
  const [user] = await sql<[TestUser]>`
    INSERT INTO users ${sql({ ...defaultUserData, ...overrides })}
    RETURNING id, name, email, phone, role
  `;
  return user;
};

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

const mockDatabaseError = () => {
  spyOn(db, "default").mockRejectedValue(new Error("Simulated database error"));
  spyOn(console, "error").mockImplementation(() => {});
};

const sendGetUsersRequest = (token?: string) => {
  const req = request(app).get("/api/users");
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

const sendGetUserByIdRequest = (id: number | string, token?: string) => {
  const req = request(app).get(`/api/users/${id}`);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

describe("Users API", () => {
  beforeEach(async () => {
    await sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`;
  });

  afterEach(() => {
    mock.restore();
  });

  describe("GET /api/users", () => {
    it("should return 200 and a list of users when records exist", async () => {
      // Arrange
      const user1 = await insertTestUser({
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "0812345677",
        role: "admin",
      });
      const user2 = await insertTestUser({
        name: "Jane Doe",
        email: "jane.doe@example.com",
        phone: "0812345678",
        role: "user",
      });

      const token = generateToken();

      // Act
      const res = await sendGetUsersRequest(token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Users fetched successfully",
        data: [user1, user2],
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
      mockDatabaseError();
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

  describe("GET /api/users/{id}", () => {
    it("should return 200 and the user when user requests their own profile", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendGetUserByIdRequest(user.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User fetched successfully",
        data: user,
      });
    });

    it("should return 200 and the user when admin requests another user's profile", async () => {
      // Arrange
      const user = await insertTestUser();
      const admin = await insertTestUser({
        name: "Admin User",
        email: "admin@example.com",
        phone: "0812345679",
        role: "admin",
      });
      const adminToken = generateToken(admin);

      // Act
      const res = await sendGetUserByIdRequest(user.id, adminToken);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User fetched successfully",
        data: user,
      });
    });

    it("should return 400 when id is not a number", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendGetUserByIdRequest("invalid_id", token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "params",
            field: "id",
            message: "Invalid user ID",
          },
        ],
      });
    });

    it("should return 400 when id is not an integer", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendGetUserByIdRequest(1.5, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "params",
            field: "id",
            message: "User ID must be an integer",
          },
        ],
      });
    });

    it("should return 400 when id is not a positive integer", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendGetUserByIdRequest(0, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "params",
            field: "id",
            message: "User ID must be a positive integer",
          },
        ],
      });
    });

    it("should return 401 when user is not authenticated", async () => {
      // Act
      const res = await sendGetUserByIdRequest(1);

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
      const res = await sendGetUserByIdRequest(1, invalidToken);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 403 when regular user requests another user's profile", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendGetUserByIdRequest(user.id + 1, token);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });
    });

    it("should return 404 when user is not found", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendGetUserByIdRequest(999, token);

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "User not found",
      });
    });

    it("should return 500 when database server is down", async () => {
      // Arrange
      mockDatabaseError();
      const token = generateToken();

      // Act
      const res = await sendGetUserByIdRequest(1, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});
