import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  spyOn,
  mock,
} from "bun:test";
import sql, * as db from "../db";
import request from "supertest";
import app from "../app";
import jwt from "jsonwebtoken";

// --- Types & Interfaces ---
interface TestUser {
  id: number;
  role: "user" | "admin";
}

interface TestProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
}

interface TestCartItem {
  cart_id: number;
  product_id: number;
  quantity: number;
}

// --- Test Helpers & Factories ---
const insertTestUser = async (
  overrides: Partial<{
    name: string;
    email: string;
    password: string;
    role: "user" | "admin";
  }> = {},
): Promise<TestUser> => {
  const payload = {
    name: "Test User",
    email: `test_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@email.com`,
    password: "password",
    role: "user" as const,
    ...overrides,
  };
  const [user] = await sql<[TestUser]>`
    INSERT INTO users ${sql(payload)} RETURNING id, role
  `;
  return user;
};

const insertTestProduct = async (
  overrides: Partial<{
    name: string;
    price: number;
    stock: number;
  }> = {},
): Promise<TestProduct> => {
  const payload = {
    name: "Test Product 1",
    price: 100,
    stock: 10,
    ...overrides,
  };
  const [product] = await sql<
    [{ id: number; name: string; price: string; stock: number }]
  >`
    INSERT INTO products ${sql(payload)} RETURNING id, name, price, stock
  `;
  return {
    ...product,
    price: parseFloat(product.price),
  };
};

const insertTestCart = async (user: Pick<TestUser, "id">) => {
  const [cart] = await sql<[{ id: number }]>`
    INSERT INTO carts (user_id) VALUES (${user.id}) RETURNING id
  `;
  return cart;
};

const insertTestCartItem = async (
  cartId: number,
  productId: number,
  quantity: number,
) => {
  const [cartItem] = await sql<[TestCartItem]>`
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (${cartId}, ${productId}, ${quantity})
    RETURNING cart_id, product_id, quantity
  `;

  return {
    cartId: cartItem.cart_id,
    productId: cartItem.product_id,
    quantity: cartItem.quantity,
  };
};

const generateToken = (
  user: Pick<TestUser, "id" | "role">,
  expiresIn: string | number = "1d",
) => {
  return jwt.sign(
    { userId: user.id, userRole: user.role },
    process.env.JWT_SECRET as string,
    {
      expiresIn: expiresIn as any,
    },
  );
};

const sendAddToCartRequest = async (
  cartData: Record<string, unknown>,
  tokenOrHeader?: string,
  rawHeader = false,
) => {
  const req = request(app).post("/api/carts").send(cartData);
  if (!tokenOrHeader) return req;
  const headerValue = rawHeader ? tokenOrHeader : `Bearer ${tokenOrHeader}`;
  return req.set("Authorization", headerValue);
};

const mockDatabaseError = () => {
  spyOn(db, "default").mockRejectedValue(new Error("Simulated database error"));
  spyOn(console, "error").mockImplementation(() => {});
};

// --- Lifecycle Hooks ---
beforeEach(async () => {
  await sql`TRUNCATE TABLE users, products, carts RESTART IDENTITY CASCADE`;
});

afterEach(() => {
  mock.restore();
});

// --- Test Suites ---
describe("POST /api/carts", () => {
  describe("Happy Path (200 OK)", () => {
    it("should return 200 and cart details when adding an item without existing cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct();
      const token = generateToken(user);

      const cartData = {
        productId: product.id,
        quantity: 2,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product added to cart successfully",
        data: {
          id: expect.any(Number),
          userId: user.id,
          items: [
            {
              ...cartData,
              name: product.name,
              price: product.price,
              subtotal: product.price * cartData.quantity,
            },
          ],
          totalQuantity: cartData.quantity,
          totalPrice: product.price * cartData.quantity,
        },
      });
    });

    it("should return 200 and cart details when adding an item to an existing cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct();
      const token = generateToken(user);
      const cart = await insertTestCart(user);

      const cartData = {
        productId: product.id,
        quantity: 2,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product added to cart successfully",
        data: {
          id: cart.id,
          userId: user.id,
          items: [
            {
              ...cartData,
              name: product.name,
              price: product.price,
              subtotal: product.price * cartData.quantity,
            },
          ],
          totalQuantity: cartData.quantity,
          totalPrice: product.price * cartData.quantity,
        },
      });
    });

    it("should return 200 and updated cart details when item already exists in cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const existingProduct = await insertTestProduct();
      const token = generateToken(user);
      const cart = await insertTestCart(user);
      const existingQuantity = 2;

      await insertTestCartItem(cart.id, existingProduct.id, existingQuantity);

      const cartData = {
        productId: existingProduct.id,
        quantity: 3,
      };

      const expectedQuantity = existingQuantity + cartData.quantity;

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product added to cart successfully",
        data: {
          id: cart.id,
          userId: user.id,
          items: [
            {
              productId: existingProduct.id,
              quantity: expectedQuantity,
              name: existingProduct.name,
              price: existingProduct.price,
              subtotal: existingProduct.price * expectedQuantity,
            },
          ],
          totalQuantity: expectedQuantity,
          totalPrice: existingProduct.price * expectedQuantity,
        },
      });
    });

    it("should return 200 and cart details when adding an item to existing cart with another item", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      const existingProductA = await insertTestProduct({
        name: "Product A",
        price: 100,
        stock: 10,
      });
      const existingProductB = await insertTestProduct({
        name: "Product B",
        price: 200,
        stock: 20,
      });

      const cart = await insertTestCart(user);
      const existingQuantity = 2;

      await insertTestCartItem(cart.id, existingProductA.id, existingQuantity);

      const cartData = {
        productId: existingProductB.id,
        quantity: 3,
      };

      const expectedQuantity = existingQuantity + cartData.quantity;
      const subtotalA = existingProductA.price * existingQuantity;
      const subtotalB = existingProductB.price * cartData.quantity;

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Product added to cart successfully",
        data: {
          id: cart.id,
          userId: user.id,
          items: [
            {
              productId: existingProductA.id,
              quantity: existingQuantity,
              name: existingProductA.name,
              price: existingProductA.price,
              subtotal: subtotalA,
            },
            {
              productId: existingProductB.id,
              quantity: cartData.quantity,
              name: existingProductB.name,
              price: existingProductB.price,
              subtotal: subtotalB,
            },
          ],
          totalQuantity: expectedQuantity,
          totalPrice: subtotalA + subtotalB,
        },
      });
    });

    it("should return 200 when adding quantity exactly equal to available stock", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 5 });
      const token = generateToken(user);

      const cartData = {
        productId: product.id,
        quantity: 5,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data.totalQuantity).toBe(5);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it("should return 200 when existing cart quantity plus new quantity equals exact stock", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 10 });
      const token = generateToken(user);
      const cart = await insertTestCart(user);

      await insertTestCartItem(cart.id, product.id, 4);

      const cartData = {
        productId: product.id,
        quantity: 6,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data.totalQuantity).toBe(10);
      expect(res.body.data.items[0].quantity).toBe(10);
    });

    it("should return 200 and correctly calculate subtotals and totalPrice with decimal prices", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ price: 19.99, stock: 10 });
      const token = generateToken(user);

      const cartData = {
        productId: product.id,
        quantity: 3,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data.items[0].price).toBe(19.99);
      expect(res.body.data.items[0].subtotal).toBe(59.97);
      expect(res.body.data.totalPrice).toBe(59.97);
    });
  });

  describe("Validation Errors - Schema (400 Bad Request)", () => {
    const validationCases = [
      {
        scenario: "productId is missing",
        payload: { quantity: 1 },
        field: "productId",
        message: "Product ID is required",
      },
      {
        scenario: "productId is not a number",
        payload: { productId: "invalid", quantity: 1 },
        field: "productId",
        message: "Product ID is required",
      },
      {
        scenario: "productId is a float",
        payload: { productId: 1.5, quantity: 1 },
        field: "productId",
        message: "Product ID must be an integer",
      },
      {
        scenario: "productId is zero",
        payload: { productId: 0, quantity: 1 },
        field: "productId",
        message: "Product ID must be a positive integer",
      },
      {
        scenario: "productId is negative",
        payload: { productId: -1, quantity: 1 },
        field: "productId",
        message: "Product ID must be a positive integer",
      },
      {
        scenario: "quantity is missing",
        payload: { productId: 1 },
        field: "quantity",
        message: "Quantity is required",
      },
      {
        scenario: "quantity is not a number",
        payload: { productId: 1, quantity: "invalid" },
        field: "quantity",
        message: "Quantity is required",
      },
      {
        scenario: "quantity is a float",
        payload: { productId: 1, quantity: 2.5 },
        field: "quantity",
        message: "Quantity must be an integer",
      },
      {
        scenario: "quantity is zero",
        payload: { productId: 1, quantity: 0 },
        field: "quantity",
        message: "Quantity must be a positive integer",
      },
      {
        scenario: "quantity is negative",
        payload: { productId: 1, quantity: -2 },
        field: "quantity",
        message: "Quantity must be a positive integer",
      },
    ];

    it.each(validationCases)(
      "should return 400 when $scenario",
      async ({ payload, field, message }) => {
        // Arrange
        const user = await insertTestUser();
        const token = generateToken(user);

        // Act
        const res = await sendAddToCartRequest(payload, token);

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

    it("should return 400 with multiple errors when payload is empty", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendAddToCartRequest({}, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "productId",
            message: "Product ID is required",
          },
          {
            location: "body",
            field: "quantity",
            message: "Quantity is required",
          },
        ],
      });
    });
  });

  describe("Validation Errors - Business Logic (400 Bad Request)", () => {
    it("should return 400 when product does not exist", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const nonExistentProductId = 99999;

      const cartData = {
        productId: nonExistentProductId,
        quantity: 1,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "productId",
            message: "Product not found",
          },
        ],
      });
    });

    it("should return 400 when requested quantity exceeds available stock", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 5 });
      const token = generateToken(user);

      const cartData = {
        productId: product.id,
        quantity: 6,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "quantity",
            message: "Requested quantity exceeds available stock",
          },
        ],
      });
    });

    it("should return 400 when product is out of stock (stock = 0)", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 0 });
      const token = generateToken(user);

      const cartData = {
        productId: product.id,
        quantity: 1,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "quantity",
            message: "Requested quantity exceeds available stock",
          },
        ],
      });
    });

    it("should return 400 when cumulative quantity exceeds available stock", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 5 });
      const token = generateToken(user);
      const cart = await insertTestCart(user);

      await insertTestCartItem(cart.id, product.id, 3);

      const cartData = {
        productId: product.id,
        quantity: 3,
      };

      // Act
      const res = await sendAddToCartRequest(cartData, token);

      // Assert
      expect(res.status).toBe(400);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Validation failed",
        errors: [
          {
            location: "body",
            field: "quantity",
            message: "Requested quantity exceeds available stock",
          },
        ],
      });
    });

    it("should not modify cart items in database when stock validation fails", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 5 });
      const token = generateToken(user);
      const cart = await insertTestCart(user);

      await insertTestCartItem(cart.id, product.id, 4);

      const cartData = {
        productId: product.id,
        quantity: 2,
      };

      // Act
      await sendAddToCartRequest(cartData, token);

      // Assert
      const [item] = await sql<[{ quantity: number }]>`
        SELECT quantity FROM cart_items WHERE cart_id = ${cart.id} AND product_id = ${product.id}
      `;
      expect(item.quantity).toBe(4);
    });
  });

  describe("User Cart Isolation", () => {
    it("should ensure separate carts and stock validation between different users", async () => {
      // Arrange
      const userA = await insertTestUser({ email: "userA@email.com" });
      const userB = await insertTestUser({ email: "userB@email.com" });
      const product = await insertTestProduct({ stock: 5 });

      const tokenA = generateToken(userA);
      const tokenB = generateToken(userB);

      // Act
      const resA = await sendAddToCartRequest(
        { productId: product.id, quantity: 3 },
        tokenA,
      );
      const resB = await sendAddToCartRequest(
        { productId: product.id, quantity: 2 },
        tokenB,
      );

      // Assert
      expect(resA.status).toBe(200);
      expect(resA.body.data.userId).toBe(userA.id);
      expect(resA.body.data.totalQuantity).toBe(3);

      expect(resB.status).toBe(200);
      expect(resB.body.data.userId).toBe(userB.id);
      expect(resB.body.data.totalQuantity).toBe(2);
      expect(resA.body.data.id).not.toBe(resB.body.data.id);
    });
  });

  describe("Authentication (401 Unauthorized)", () => {
    it("should return 401 when user is unauthenticated (missing header)", async () => {
      // Act
      const res = await sendAddToCartRequest({ productId: 1, quantity: 1 });

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when Authorization header does not start with Bearer", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendAddToCartRequest(
        { productId: 1, quantity: 1 },
        `Basic ${token}`,
        true,
      );

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Act
      const res = await sendAddToCartRequest(
        { productId: 1, quantity: 1 },
        "invalid.token.here",
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
      const user = await insertTestUser();
      const expiredToken = generateToken(user, "-1s");

      // Act
      const res = await sendAddToCartRequest(
        { productId: 1, quantity: 1 },
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

  describe("Server Errors (500)", () => {
    it("should return 500 when database server is down", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      mockDatabaseError();

      // Act
      const res = await sendAddToCartRequest(
        { productId: 1, quantity: 1 },
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
