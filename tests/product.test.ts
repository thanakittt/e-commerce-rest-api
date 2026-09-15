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
) => {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "1d",
  });
};

const createProductPayload = (overrides: Record<string, unknown> = {}) => ({
  name: "Test Product",
  description: "Test Description",
  price: 100.0,
  stock: 10,
  ...overrides,
});

const sendCreateProductRequest = async (
  productData: Record<string, unknown>,
  token: string,
) => {
  return await request(app)
    .post("/api/products")
    .send(productData)
    .set("Authorization", `Bearer ${token}`);
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
describe("POST /api/products", () => {
  describe("Happy Path (201 Created)", () => {
    it("should return 201 and the created product when valid data is provided", async () => {
      // Arrange
      const category = await insertTestCategory();
      const productData = createProductPayload({ categoryId: category.id });
      const token = generateToken();

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product created successfully",
        data: {
          id: 1,
          ...productData,
        },
      });
    });

    it("should return 201 and the created product when optional fields are omitted", async () => {
      // Arrange
      const productData = {
        name: "Test Product Without Optionals",
        price: 100.0,
        stock: 10,
      };
      const token = generateToken();

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product created successfully",
        data: {
          id: 1,
          name: "Test Product Without Optionals",
          description: null,
          price: 100.0,
          stock: 10,
          categoryId: null,
        },
      });
    });

    it("should return 201 and the created product when optional fields are null", async () => {
      // Arrange
      const productData = createProductPayload({
        name: "Test Product With Nulls",
        description: null,
        categoryId: null,
      });
      const token = generateToken();

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product created successfully",
        data: {
          id: 1,
          ...productData,
        },
      });
    });

    it("should return 201 and properly format decimal price", async () => {
      // Arrange
      const category = await insertTestCategory();
      const productData = createProductPayload({
        name: "Decimal Price Product",
        description: "Testing decimal precision",
        price: 99.99,
        stock: 5,
        categoryId: category.id,
      });
      const token = generateToken();

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product created successfully",
        data: {
          id: 1,
          ...productData,
        },
      });
    });

    it("should return 201 when stock is 0 (boundary value)", async () => {
      // Arrange
      const category = await insertTestCategory();
      const productData = createProductPayload({
        name: "Zero Stock Product",
        description: "Out of stock item",
        price: 50.0,
        stock: 0,
        categoryId: category.id,
      });
      const token = generateToken();

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product created successfully",
        data: {
          id: 1,
          ...productData,
        },
      });
    });
  });

  describe("Validation Errors (400)", () => {
    const validationCases = [
      {
        scenario: "name is missing",
        payload: { description: "Test Description", price: 100.0, stock: 10 },
        field: "name",
        message: "Name is required",
      },
      {
        scenario: "name is empty",
        payload: createProductPayload({ name: "" }),
        field: "name",
        message: "Name cannot be empty",
      },
      {
        scenario: "name is whitespace only",
        payload: createProductPayload({ name: "   " }),
        field: "name",
        message: "Name cannot be empty",
      },
      {
        scenario: "description is empty",
        payload: createProductPayload({ description: "" }),
        field: "description",
        message: "Description cannot be empty",
      },
      {
        scenario: "description is whitespace only",
        payload: createProductPayload({ description: "   " }),
        field: "description",
        message: "Description cannot be empty",
      },
      {
        scenario: "price is missing",
        payload: { name: "Test Product", description: "Test Description", stock: 10 },
        field: "price",
        message: "Price is required",
      },
      {
        scenario: "price is not a number",
        payload: createProductPayload({ price: "invalid" }),
        field: "price",
        message: "Price is required",
      },
      {
        scenario: "price is zero",
        payload: createProductPayload({ price: 0 }),
        field: "price",
        message: "Price must be a positive number",
      },
      {
        scenario: "price is negative",
        payload: createProductPayload({ price: -100.0 }),
        field: "price",
        message: "Price must be a positive number",
      },
      {
        scenario: "stock is missing",
        payload: { name: "Test Product", description: "Test Description", price: 100.0 },
        field: "stock",
        message: "Stock is required",
      },
      {
        scenario: "stock is not a number",
        payload: createProductPayload({ stock: "invalid" }),
        field: "stock",
        message: "Stock is required",
      },
      {
        scenario: "stock is a float",
        payload: createProductPayload({ stock: 10.5 }),
        field: "stock",
        message: "Stock must be an integer",
      },
      {
        scenario: "stock is negative",
        payload: createProductPayload({ stock: -1 }),
        field: "stock",
        message: "Stock cannot be negative",
      },
      {
        scenario: "categoryId is not a number",
        payload: createProductPayload({ categoryId: "invalid" }),
        field: "categoryId",
        message: "Category ID must be a number",
      },
      {
        scenario: "categoryId is not an integer",
        payload: createProductPayload({ categoryId: 1.5 }),
        field: "categoryId",
        message: "Category ID must be an integer",
      },
      {
        scenario: "categoryId is not a positive integer",
        payload: createProductPayload({ categoryId: 0 }),
        field: "categoryId",
        message: "Category ID must be a positive integer",
      },
      {
        scenario: "unrecognized fields are provided",
        payload: createProductPayload({ extraField: "unexpected" }),
        field: "body",
        message: 'Unrecognized key: "extraField"',
      },
    ];

    it.each(validationCases)(
      "should return 400 when $scenario",
      async ({ payload, field, message }) => {
        // Arrange
        const token = generateToken();

        // Act
        const res = await sendCreateProductRequest(payload, token);

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

  describe("Authentication & Authorization (401 / 403)", () => {
    it("should return 401 when user is not authenticated", async () => {
      // Arrange
      const productData = createProductPayload();
      const token = "";

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Arrange
      const productData = createProductPayload();
      const invalidToken = "invalid_token";

      // Act
      const res = await sendCreateProductRequest(productData, invalidToken);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 403 when regular user tries to create a product", async () => {
      // Arrange
      const productData = createProductPayload();
      const token = generateToken({ userId: 1, userRole: "user" });

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });
    });
  });

  describe("Relational & Foreign Key Validation (400)", () => {
    it("should return 400 when category does not exist", async () => {
      // Arrange
      const productData = createProductPayload({ categoryId: 99999 });
      const token = generateToken();

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "categoryId",
            message: "Category not found",
          },
        ],
      });
    });
  });

  describe("Server Errors (500)", () => {
    it("should return 500 when database server is down", async () => {
      // Arrange
      mockDatabaseError();
      const productData = createProductPayload({ categoryId: 1 });
      const token = generateToken();

      // Act
      const res = await sendCreateProductRequest(productData, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});
