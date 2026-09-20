import sql, * as db from "../db";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app";

// --- Types & Interfaces ---
interface TestCategory {
  id: number;
  name: string;
}

type UserRole = "admin" | "user";

// --- Test Helpers & Factories ---
const insertTestCategory = async (
  name = "Electronics",
): Promise<TestCategory> => {
  const [category] = await sql<[TestCategory]>`
    INSERT INTO categories (name)
    VALUES (${name})
    RETURNING id, name
  `;
  return category;
};

const generateToken = (
  payload = { userId: 1, userRole: "admin" as UserRole },
  options?: jwt.SignOptions,
) => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "1d",
    ...options,
  });
};

const sendGetAllCategoriesRequest = async () => {
  return request(app).get("/api/categories");
};

const sendCreateCategoryRequest = async (
  categoryData: Record<string, unknown>,
  token?: string,
) => {
  const req = request(app).post("/api/categories").send(categoryData);
  return token ? req.set("Authorization", `Bearer ${token}`) : req;
};

const mockDatabaseError = () => {
  spyOn(db, "default").mockRejectedValue(new Error("Simulated database error"));
  spyOn(console, "error").mockImplementation(() => {});
};

// --- Lifecycle Hooks ---
beforeEach(async () => {
  await sql`TRUNCATE TABLE products, categories RESTART IDENTITY CASCADE`;
});

afterEach(() => {
  mock.restore();
});

// --- Test Suites ---
describe("GET /api/categories", () => {
  describe("Happy Path (200 OK)", () => {
    it("should return 200 and all categories when categories exist", async () => {
      // Arrange
      const cat1 = await insertTestCategory("Electronics");
      const cat2 = await insertTestCategory("Clothing");

      // Act
      const res = await sendGetAllCategoriesRequest();

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Categories fetched successfully",
        data: [
          { id: cat1.id, name: cat1.name },
          { id: cat2.id, name: cat2.name },
        ],
      });
    });

    it("should return 200 and empty list when no categories are present", async () => {
      // Act
      const res = await sendGetAllCategoriesRequest();

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Categories fetched successfully",
        data: [],
      });
    });

    it("should be accessible publicly without authentication", async () => {
      // Arrange
      await insertTestCategory("Books");

      // Act
      const res = await sendGetAllCategoriesRequest();

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Server Errors (500)", () => {
    it("should return 500 when database server is down", async () => {
      // Arrange
      mockDatabaseError();

      // Act
      const res = await sendGetAllCategoriesRequest();

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});

describe("POST /api/categories", () => {
  describe("Happy Path (201 Created)", () => {
    it("should return 201 and created category when valid data is provided by admin", async () => {
      // Arrange
      const categoryData = { name: "Electronics" };
      const token = generateToken({ userId: 1, userRole: "admin" });

      // Act
      const res = await sendCreateCategoryRequest(categoryData, token);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Category created successfully",
        data: {
          id: expect.any(Number),
          name: "Electronics",
        },
      });

      const [storedCategory] = await sql<[TestCategory]>`
        SELECT id, name FROM categories WHERE id = ${res.body.data.id}
      `;
      expect(storedCategory).toBeDefined();
      expect(storedCategory.name).toBe("Electronics");
    });

    it("should trim whitespace from category name", async () => {
      // Arrange
      const categoryData = { name: "   Electronics   " };
      const token = generateToken({ userId: 1, userRole: "admin" });

      // Act
      const res = await sendCreateCategoryRequest(categoryData, token);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("Electronics");
    });
  });

  describe("Validation Errors (400)", () => {
    const validationCases = [
      {
        scenario: "name is missing",
        payload: {},
        field: "name",
        message: "Name is required",
      },
      {
        scenario: "name is empty",
        payload: { name: "" },
        field: "name",
        message: "Name cannot be empty",
      },
      {
        scenario: "name is whitespace only",
        payload: { name: "   " },
        field: "name",
        message: "Name cannot be empty",
      },
      {
        scenario: "unrecognized fields are provided",
        payload: { name: "Books", extra: 123 },
        field: "body",
        message: 'Unrecognized key: "extra"',
      },
    ];

    it.each(validationCases)(
      "should return 400 when $scenario",
      async ({ payload, field, message }) => {
        // Arrange
        const token = generateToken();

        // Act
        const res = await sendCreateCategoryRequest(payload, token);

        // Assert
        expect(res.status).toBe(400);
        expect(res.body).toStrictEqual({
          success: false,
          message: "Validation failed",
          errors: [
            {
              location: "body",
              field,
              message,
            },
          ],
        });
      },
    );
  });

  describe("Authentication (401 Unauthorized)", () => {
    it("should return 401 when user is not authenticated (missing header)", async () => {
      // Act
      const res = await sendCreateCategoryRequest({ name: "Electronics" });

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when Authorization header does not start with Bearer", async () => {
      // Act
      const res = await request(app)
        .post("/api/categories")
        .set("Authorization", "Basic invalidtoken")
        .send({ name: "Electronics" });

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Act
      const res = await sendCreateCategoryRequest(
        { name: "Electronics" },
        "invalid-token",
      );

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is expired", async () => {
      // Arrange
      const expiredToken = jwt.sign(
        { userId: 1, userRole: "admin" },
        process.env.JWT_SECRET as string,
        { expiresIn: "0s" },
      );

      // Act
      const res = await sendCreateCategoryRequest(
        { name: "Electronics" },
        expiredToken,
      );

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });
  });

  describe("Authorization (403 Forbidden)", () => {
    it("should return 403 when regular user tries to create a category", async () => {
      // Arrange
      const userToken = generateToken({ userId: 2, userRole: "user" });

      // Act
      const res = await sendCreateCategoryRequest(
        { name: "Electronics" },
        userToken,
      );

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });
    });
  });

  describe("Conflict (409 Conflict)", () => {
    it("should return 409 when category already exists", async () => {
      // Arrange
      await insertTestCategory("Electronics");
      const token = generateToken({ userId: 1, userRole: "admin" });

      // Act
      const res = await sendCreateCategoryRequest(
        { name: "Electronics" },
        token,
      );

      // Assert
      expect(res.status).toBe(409);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Category already exists",
      });
    });
  });

  describe("Server Errors (500)", () => {
    it("should return 500 when database server is down", async () => {
      // Arrange
      const token = generateToken({ userId: 1, userRole: "admin" });
      mockDatabaseError();

      // Act
      const res = await sendCreateCategoryRequest(
        { name: "Electronics" },
        token,
      );

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});
