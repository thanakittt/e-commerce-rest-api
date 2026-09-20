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

const sendUpdateUserByIdRequest = (
  id: number | string,
  body: Record<string, unknown>,
  token?: string,
) => {
  const req = request(app).put(`/api/users/${id}`).send(body);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

const sendGetUserProfileRequest = (token?: string) => {
  const req = request(app).get("/api/users/profile");
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

const sendUpdateUserProfileRequest = (
  body: Record<string, unknown>,
  token?: string,
) => {
  const req = request(app).put("/api/users/profile").send(body);
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

  describe("PUT /api/users/{id}", () => {
    const updatedUserData = {
      name: "John Doe Updated",
      email: "john.doe.updated@example.com",
      phone: "0999999999",
    };

    it("should return 200 and the updated user when user requests their own profile", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendUpdateUserByIdRequest(
        user.id,
        updatedUserData,
        token,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User updated successfully",
        data: {
          ...updatedUserData,
          id: user.id,
          role: user.role,
        },
      });
    });

    it("should return 200 and the updated user when admin requests another user's profile", async () => {
      // Arrange
      const targetUser = await insertTestUser();
      const admin = await insertTestUser({
        name: "Admin User",
        email: "admin@example.com",
        phone: "0812345679",
        role: "admin",
      });
      const adminToken = generateToken(admin);

      // Act
      const res = await sendUpdateUserByIdRequest(
        targetUser.id,
        updatedUserData,
        adminToken,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User updated successfully",
        data: {
          ...updatedUserData,
          id: targetUser.id,
          role: targetUser.role,
        },
      });
    });

    it("should return 200 and the updated user when keeping existing email and phone", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const updateData = {
        name: "John Doe Renamed",
        email: user.email,
        phone: user.phone,
      };

      // Act
      const res = await sendUpdateUserByIdRequest(user.id, updateData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User updated successfully",
        data: {
          ...updateData,
          id: user.id,
          role: user.role,
        },
      });
    });

    it("should return 400 when id is not a number", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserByIdRequest(
        "invalid_id",
        updatedUserData,
        token,
      );

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
      const res = await sendUpdateUserByIdRequest(1.5, updatedUserData, token);

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
      const res = await sendUpdateUserByIdRequest(0, updatedUserData, token);

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

    it("should return 400 when name is empty", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserByIdRequest(
        1,
        { ...updatedUserData, name: "" },
        token,
      );

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "name",
            message: "Name cannot be empty",
          },
        ],
      });
    });

    it("should return 400 when email format is invalid", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserByIdRequest(
        1,
        { ...updatedUserData, email: "invalid-email" },
        token,
      );

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "email",
            message: "Invalid email address",
          },
        ],
      });
    });

    it("should return 400 when unrecognized fields are provided", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserByIdRequest(
        1,
        { ...updatedUserData, role: "admin" },
        token,
      );

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "body",
            message: 'Unrecognized key: "role"',
          },
        ],
      });
    });

    it("should return 401 when user is not authenticated", async () => {
      // Act
      const res = await sendUpdateUserByIdRequest(1, updatedUserData);

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
      const res = await sendUpdateUserByIdRequest(
        1,
        updatedUserData,
        invalidToken,
      );

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
      const res = await sendUpdateUserByIdRequest(
        user.id + 1,
        updatedUserData,
        token,
      );

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });
    });

    it("should return 404 when user to update is not found", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserByIdRequest(999, updatedUserData, token);

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "User not found",
      });
    });

    it("should return 409 when email already exists", async () => {
      // Arrange
      const existingUser = await insertTestUser({
        email: "existing.user@example.com",
        phone: "0912345678",
      });
      const userToUpdate = await insertTestUser();
      const token = generateToken(userToUpdate);

      // Act
      const res = await sendUpdateUserByIdRequest(
        userToUpdate.id,
        { ...updatedUserData, email: existingUser.email },
        token,
      );

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Email already exists",
      });
    });

    it("should return 409 when phone already exists", async () => {
      // Arrange
      const existingUser = await insertTestUser({
        email: "existing.user@example.com",
        phone: "0912345678",
      });
      const userToUpdate = await insertTestUser();
      const token = generateToken(userToUpdate);

      // Act
      const res = await sendUpdateUserByIdRequest(
        userToUpdate.id,
        { ...updatedUserData, phone: existingUser.phone },
        token,
      );

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Phone already exists",
      });
    });

    it("should return 500 when database server is down", async () => {
      // Arrange
      mockDatabaseError();
      const token = generateToken();

      // Act
      const res = await sendUpdateUserByIdRequest(1, updatedUserData, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });

  describe("GET /api/users/profile", () => {
    it("should return 200 and user profile when authenticated", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendGetUserProfileRequest(token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User profile fetched successfully",
        data: user,
      });
    });

    it("should return 401 when user is not authenticated", async () => {
      // Act
      const res = await sendGetUserProfileRequest();

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
      const res = await sendGetUserProfileRequest(invalidToken);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 404 when user is not found", async () => {
      // Arrange
      const token = generateToken({ id: 999 });

      // Act
      const res = await sendGetUserProfileRequest(token);

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
      const res = await sendGetUserProfileRequest(token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });

  describe("PUT /api/users/profile", () => {
    const updatedProfileData = {
      name: "Jane Doe Updated",
      email: "jane.doe.updated@example.com",
      phone: "0998887777",
    };

    it("should return 200 and the updated user profile when authenticated", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendUpdateUserProfileRequest(updatedProfileData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User profile updated successfully",
        data: {
          ...updatedProfileData,
          id: user.id,
          role: user.role,
        },
      });
    });

    it("should return 200 and the updated user profile when keeping existing email and phone", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const updateData = {
        name: "Jane Doe Renamed",
        email: user.email,
        phone: user.phone,
      };

      // Act
      const res = await sendUpdateUserProfileRequest(updateData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "User profile updated successfully",
        data: {
          ...updateData,
          id: user.id,
          role: user.role,
        },
      });
    });

    it("should return 400 when name is empty", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserProfileRequest(
        { ...updatedProfileData, name: "" },
        token,
      );

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "name",
            message: "Name cannot be empty",
          },
        ],
      });
    });

    it("should return 400 when email format is invalid", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserProfileRequest(
        { ...updatedProfileData, email: "invalid-email" },
        token,
      );

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "email",
            message: "Invalid email address",
          },
        ],
      });
    });

    it("should return 400 when unrecognized fields are provided", async () => {
      // Arrange
      const token = generateToken();

      // Act
      const res = await sendUpdateUserProfileRequest(
        { ...updatedProfileData, role: "admin" },
        token,
      );

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "body",
            message: 'Unrecognized key: "role"',
          },
        ],
      });
    });

    it("should return 401 when user is not authenticated", async () => {
      // Act
      const res = await sendUpdateUserProfileRequest(updatedProfileData);

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
      const res = await sendUpdateUserProfileRequest(
        updatedProfileData,
        invalidToken,
      );

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 404 when user is not found", async () => {
      // Arrange
      const token = generateToken({ id: 999 });

      // Act
      const res = await sendUpdateUserProfileRequest(updatedProfileData, token);

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "User not found",
      });
    });

    it("should return 409 when email already exists", async () => {
      // Arrange
      const existingUser = await insertTestUser({
        email: "existing.profile@example.com",
        phone: "0923456789",
      });
      const userToUpdate = await insertTestUser();
      const token = generateToken(userToUpdate);

      // Act
      const res = await sendUpdateUserProfileRequest(
        { ...updatedProfileData, email: existingUser.email },
        token,
      );

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Email already exists",
      });
    });

    it("should return 409 when phone already exists", async () => {
      // Arrange
      const existingUser = await insertTestUser({
        email: "existing.profile@example.com",
        phone: "0923456789",
      });
      const userToUpdate = await insertTestUser();
      const token = generateToken(userToUpdate);

      // Act
      const res = await sendUpdateUserProfileRequest(
        { ...updatedProfileData, phone: existingUser.phone },
        token,
      );

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Phone already exists",
      });
    });

    it("should return 500 when database server is down", async () => {
      // Arrange
      mockDatabaseError();
      const token = generateToken();

      // Act
      const res = await sendUpdateUserProfileRequest(updatedProfileData, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});
