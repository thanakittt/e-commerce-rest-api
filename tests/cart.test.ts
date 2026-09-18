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

const setupTestCartWithItems = async (user: Pick<TestUser, "id">) => {
  const cart = await insertTestCart(user);
  const productA = await insertTestProduct({ name: "Product A", price: 100 });
  const productB = await insertTestProduct({ name: "Product B", price: 200 });
  const cartItemA = await insertTestCartItem(cart.id, productA.id, 2);
  const cartItemB = await insertTestCartItem(cart.id, productB.id, 3);

  const subtotalA = cartItemA.quantity * productA.price;
  const subtotalB = cartItemB.quantity * productB.price;
  const totalPrice = subtotalA + subtotalB;
  const totalQuantity = cartItemA.quantity + cartItemB.quantity;

  const expectedData = {
    id: cart.id,
    userId: user.id,
    items: [
      {
        productId: productA.id,
        name: productA.name,
        price: productA.price,
        quantity: cartItemA.quantity,
        subtotal: subtotalA,
      },
      {
        productId: productB.id,
        name: productB.name,
        price: productB.price,
        quantity: cartItemB.quantity,
        subtotal: subtotalB,
      },
    ],
    totalPrice,
    totalQuantity,
  };

  return { cart, expectedData };
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

const sendGetCartRequest = async (id: string | number, token?: string) => {
  const req = request(app).get(`/api/carts/${id}`);
  if (!token) return req;
  return req.set("Authorization", `Bearer ${token}`);
};

const sendDeleteCartRequest = async (id: string | number, token?: string) => {
  const req = request(app).delete(`/api/carts/${id}`);
  if (!token) return req;
  return req.set("Authorization", `Bearer ${token}`);
};

const sendDeleteCartItemRequest = async (
  cartId: string | number,
  productId: string | number,
  token?: string,
) => {
  const req = request(app).delete(`/api/carts/${cartId}/items/${productId}`);
  if (!token) return req;
  return req.set("Authorization", `Bearer ${token}`);
};

const sendUpdateCartItemRequest = async (
  cartId: string | number,
  productId: string | number,
  body?: Record<string, unknown>,
  token?: string,
) => {
  const req = request(app).put(`/api/carts/${cartId}/items/${productId}`);
  if (body !== undefined) {
    req.send(body);
  }
  if (!token) return req;
  return req.set("Authorization", `Bearer ${token}`);
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

describe("GET /api/carts/:id", () => {
  describe("Happy Path (200 OK)", () => {
    it("should return 200 and cart details when user requests own cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const { cart, expectedData } = await setupTestCartWithItems(user);

      // Act
      const res = await sendGetCartRequest(cart.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Cart fetched successfully",
        data: expectedData,
      });
    });

    it("should return 200 and cart details when admin requests another user's cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const admin = await insertTestUser({ role: "admin" });
      const token = generateToken(admin);
      const { cart, expectedData } = await setupTestCartWithItems(user);

      // Act
      const res = await sendGetCartRequest(cart.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Cart fetched successfully",
        data: expectedData,
      });
    });

    it("should return 200 with empty items when cart exists but has no items", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const cart = await insertTestCart(user);

      // Act
      const res = await sendGetCartRequest(cart.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Cart fetched successfully",
        data: {
          id: cart.id,
          userId: user.id,
          items: [],
          totalPrice: 0,
          totalQuantity: 0,
        },
      });
    });
  });

  describe("Validation Errors - Schema (400 Bad Request)", () => {
    const validationCases = [
      {
        scenario: "cart id is not a number",
        id: "abc",
        message: "Cart ID is required",
      },
      {
        scenario: "cart id is a float",
        id: 1.5,
        message: "Cart ID must be an integer",
      },
      {
        scenario: "cart id is zero",
        id: 0,
        message: "Cart ID must be a positive integer",
      },
      {
        scenario: "cart id is negative",
        id: -1,
        message: "Cart ID must be a positive integer",
      },
    ];

    it.each(validationCases)(
      "should return 400 when $scenario",
      async ({ id, message }) => {
        // Arrange
        const user = await insertTestUser();
        const token = generateToken(user);

        // Act
        const res = await sendGetCartRequest(id, token);

        // Assert
        expect(res.status).toBe(400);
        expect(res.body).toStrictEqual({
          success: false,
          message: "Validation failed",
          errors: [
            {
              location: "params",
              field: "id",
              message,
            },
          ],
        });
      },
    );
  });

  describe("Authentication (401 Unauthorized)", () => {
    it("should return 401 when user is unauthenticated", async () => {
      // Act
      const res = await sendGetCartRequest(1);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });
  });

  describe("Authorization (403 Forbidden)", () => {
    it("should return 403 when user tries to access another user's cart", async () => {
      // Arrange
      const userA = await insertTestUser({ email: "userA@email.com" });
      const cartA = await insertTestCart(userA);

      const userB = await insertTestUser({ email: "userB@email.com" });
      const tokenB = generateToken(userB);

      // Act
      const res = await sendGetCartRequest(cartA.id, tokenB);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });
    });
  });

  describe("Not Found (404 Not Found)", () => {
    it("should return 404 when cart is not found", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendGetCartRequest(999, token);

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Not found",
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
      const res = await sendGetCartRequest(1, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});

describe("DELETE /api/carts/:id", () => {
  describe("Happy Path (200 OK)", () => {
    it("should return 200 and delete the cart when user deletes own cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const { cart } = await setupTestCartWithItems(user);

      // Act
      const res = await sendDeleteCartRequest(cart.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Cart deleted successfully",
      });

      const [cartInDb] = await sql`SELECT id FROM carts WHERE id = ${cart.id}`;
      expect(cartInDb).toBeUndefined();

      const itemsInDb =
        await sql`SELECT * FROM cart_items WHERE cart_id = ${cart.id}`;
      expect(itemsInDb).toHaveLength(0);
    });

    it("should return 200 and delete the cart when admin deletes another user's cart", async () => {
      // Arrange
      const user = await insertTestUser({ email: "user@email.com" });
      const { cart } = await setupTestCartWithItems(user);

      const admin = await insertTestUser({
        email: "admin@email.com",
        role: "admin",
      });
      const adminToken = generateToken(admin);

      // Act
      const res = await sendDeleteCartRequest(cart.id, adminToken);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Cart deleted successfully",
      });

      const [cartInDb] = await sql`SELECT id FROM carts WHERE id = ${cart.id}`;
      expect(cartInDb).toBeUndefined();
    });
  });

  describe("Validation Errors - Schema (400 Bad Request)", () => {
    const validationCases = [
      {
        scenario: "cart id is not a number",
        id: "abc",
        message: "Cart ID is required",
      },
      {
        scenario: "cart id is a float",
        id: 1.5,
        message: "Cart ID must be an integer",
      },
      {
        scenario: "cart id is zero",
        id: 0,
        message: "Cart ID must be a positive integer",
      },
      {
        scenario: "cart id is negative",
        id: -1,
        message: "Cart ID must be a positive integer",
      },
    ];

    it.each(validationCases)(
      "should return 400 when $scenario",
      async ({ id, message }) => {
        // Arrange
        const user = await insertTestUser();
        const token = generateToken(user);

        // Act
        const res = await sendDeleteCartRequest(id, token);

        // Assert
        expect(res.status).toBe(400);
        expect(res.body).toStrictEqual({
          success: false,
          message: "Validation failed",
          errors: [
            {
              location: "params",
              field: "id",
              message,
            },
          ],
        });
      },
    );
  });

  describe("Authentication (401 Unauthorized)", () => {
    it("should return 401 when user is unauthenticated", async () => {
      // Act
      const res = await sendDeleteCartRequest(1);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Act
      const res = await sendDeleteCartRequest(1, "invalid-token");

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
      const res = await sendDeleteCartRequest(1, expiredToken);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });
  });

  describe("Authorization (403 Forbidden)", () => {
    it("should return 403 when user tries to delete another user's cart", async () => {
      // Arrange
      const userA = await insertTestUser({ email: "userA@email.com" });
      const { cart: cartA } = await setupTestCartWithItems(userA);

      const userB = await insertTestUser({ email: "userB@email.com" });
      const tokenB = generateToken(userB);

      // Act
      const res = await sendDeleteCartRequest(cartA.id, tokenB);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });

      const [cartInDb] = await sql`SELECT id FROM carts WHERE id = ${cartA.id}`;
      expect(cartInDb).toBeDefined();
    });
  });

  describe("Not Found (404 Not Found)", () => {
    it("should return 404 when cart is not found", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendDeleteCartRequest(999, token);

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Not found",
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
      const res = await sendDeleteCartRequest(1, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});

describe("DELETE /api/carts/:cartId/items/:productId", () => {
  describe("Happy Path (200 OK)", () => {
    it("should return 200 when user successfully removes an item from cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const product = await insertTestProduct();
      const cart = await insertTestCart(user);
      await insertTestCartItem(cart.id, product.id, 3);

      // Act
      const res = await sendDeleteCartItemRequest(cart.id, product.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Item removed from cart successfully",
      });

      // Verify item is removed
      const [itemInDb] = await sql`
        SELECT * FROM cart_items 
        WHERE cart_id = ${cart.id} AND product_id = ${product.id}
      `;
      expect(itemInDb).toBeUndefined();
    });

    it("should return 200 and remove item when admin deletes another user's cart item", async () => {
      // Arrange
      const user = await insertTestUser({ email: "user@email.com" });
      const product = await insertTestProduct();
      const cart = await insertTestCart(user);
      await insertTestCartItem(cart.id, product.id, 2);

      const admin = await insertTestUser({
        email: "admin@email.com",
        role: "admin",
      });
      const adminToken = generateToken(admin);

      // Act
      const res = await sendDeleteCartItemRequest(
        cart.id,
        product.id,
        adminToken,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Item removed from cart successfully",
      });

      const [itemInDb] = await sql`
        SELECT * FROM cart_items 
        WHERE cart_id = ${cart.id} AND product_id = ${product.id}
      `;
      expect(itemInDb).toBeUndefined();
    });

    it("should return 200 and keep other items intact when deleting one item from a multi-item cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const { cart } = await setupTestCartWithItems(user);

      const items = await sql<{ product_id: number }[]>`
        SELECT product_id FROM cart_items WHERE cart_id = ${cart.id} ORDER BY product_id ASC
      `;
      const productToDeleteId = items[0]!.product_id;
      const productToKeepId = items[1]!.product_id;

      // Act
      const res = await sendDeleteCartItemRequest(
        cart.id,
        productToDeleteId,
        token,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Item removed from cart successfully",
      });

      const remainingItems = await sql<{ product_id: number }[]>`
        SELECT product_id FROM cart_items WHERE cart_id = ${cart.id}
      `;
      expect(remainingItems).toHaveLength(1);
      expect(remainingItems[0]!.product_id).toBe(productToKeepId);
    });

    it("should return 200 when item does not exist in cart (idempotent)", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const cart = await insertTestCart(user);
      const nonExistentProductId = 999;

      // Act
      const res = await sendDeleteCartItemRequest(
        cart.id,
        nonExistentProductId,
        token,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Item removed from cart successfully",
      });
    });
  });

  describe("Validation Errors - Schema (400 Bad Request)", () => {
    const validationCases = [
      {
        scenario: "cart id is not a number",
        cartId: "abc",
        productId: 1,
        field: "cartId",
        message: "Cart ID is required",
      },
      {
        scenario: "cart id is a float",
        cartId: 1.5,
        productId: 1,
        field: "cartId",
        message: "Cart ID must be an integer",
      },
      {
        scenario: "cart id is zero",
        cartId: 0,
        productId: 1,
        field: "cartId",
        message: "Cart ID must be a positive integer",
      },
      {
        scenario: "cart id is negative",
        cartId: -1,
        productId: 1,
        field: "cartId",
        message: "Cart ID must be a positive integer",
      },
      {
        scenario: "product id is not a number",
        cartId: 1,
        productId: "abc",
        field: "productId",
        message: "Product ID is required",
      },
      {
        scenario: "product id is a float",
        cartId: 1,
        productId: 1.5,
        field: "productId",
        message: "Product ID must be an integer",
      },
      {
        scenario: "product id is zero",
        cartId: 1,
        productId: 0,
        field: "productId",
        message: "Product ID must be a positive integer",
      },
      {
        scenario: "product id is negative",
        cartId: 1,
        productId: -1,
        field: "productId",
        message: "Product ID must be a positive integer",
      },
    ];

    it.each(validationCases)(
      "should return 400 when $scenario",
      async ({ cartId, productId, field, message }) => {
        // Arrange
        const user = await insertTestUser();
        const token = generateToken(user);

        // Act
        const res = await sendDeleteCartItemRequest(cartId, productId, token);

        // Assert
        expect(res.status).toBe(400);
        expect(res.body).toStrictEqual({
          success: false,
          message: "Validation failed",
          errors: [
            {
              location: "params",
              field,
              message,
            },
          ],
        });
      },
    );
  });

  describe("Authentication (401 Unauthorized)", () => {
    it("should return 401 when user is unauthenticated", async () => {
      // Act
      const res = await sendDeleteCartItemRequest(1, 1);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Act
      const res = await sendDeleteCartItemRequest(1, 1, "invalid-token");

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
      const res = await sendDeleteCartItemRequest(1, 1, expiredToken);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });
  });

  describe("Authorization (403 Forbidden)", () => {
    it("should return 403 when user tries to remove item from another user's cart", async () => {
      // Arrange
      const userA = await insertTestUser({ email: "userA@email.com" });
      const product = await insertTestProduct();
      const cartA = await insertTestCart(userA);
      await insertTestCartItem(cartA.id, product.id, 2);

      const userB = await insertTestUser({ email: "userB@email.com" });
      const tokenB = generateToken(userB);

      // Act
      const res = await sendDeleteCartItemRequest(cartA.id, product.id, tokenB);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });

      // Verify item was not deleted
      const [itemInDb] = await sql`
        SELECT * FROM cart_items 
        WHERE cart_id = ${cartA.id} AND product_id = ${product.id}
      `;
      expect(itemInDb).toBeDefined();
    });
  });

  describe("Not Found (404 Not Found)", () => {
    it("should return 404 when cart is not found", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendDeleteCartItemRequest(999, 1, token);

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Not found",
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
      const res = await sendDeleteCartItemRequest(1, 1, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});

describe("PUT /api/carts/:cartId/items/:productId", () => {
  describe("Happy Path (200 OK)", () => {
    it("should return 200 and updated cart details when updating an item in the cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const product = await insertTestProduct();
      const cart = await insertTestCart(user);
      await insertTestCartItem(cart.id, product.id, 2);
      const newQuantity = 5;

      const subtotal = product.price * newQuantity;

      // Act
      const res = await sendUpdateCartItemRequest(
        cart.id,
        product.id,
        { quantity: newQuantity },
        token,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Item quantity updated successfully",
        data: {
          id: cart.id,
          userId: user.id,
          items: [
            {
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: newQuantity,
              subtotal,
            },
          ],
          totalPrice: subtotal,
          totalQuantity: newQuantity,
        },
      });
    });

    it("should return 200 and updated cart details when admin updates an item in another user's cart", async () => {
      // Arrange
      const owner = await insertTestUser({ email: "owner@email.com" });
      const admin = await insertTestUser({
        email: "admin@email.com",
        role: "admin",
      });
      const adminToken = generateToken(admin);
      const product = await insertTestProduct();
      const cart = await insertTestCart(owner);
      await insertTestCartItem(cart.id, product.id, 2);
      const newQuantity = 4;

      const subtotal = product.price * newQuantity;

      // Act
      const res = await sendUpdateCartItemRequest(
        cart.id,
        product.id,
        { quantity: newQuantity },
        adminToken,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Item quantity updated successfully",
        data: {
          id: cart.id,
          userId: owner.id,
          items: [
            {
              productId: product.id,
              name: product.name,
              price: product.price,
              quantity: newQuantity,
              subtotal,
            },
          ],
          totalPrice: subtotal,
          totalQuantity: newQuantity,
        },
      });
    });

    it("should return 200 and recalculate totalQuantity and totalPrice correctly when cart has multiple items", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const { cart } = await setupTestCartWithItems(user);
      const itemsInDb = await sql<{ product_id: number }[]>`
        SELECT product_id FROM cart_items WHERE cart_id = ${cart.id} ORDER BY product_id ASC
      `;
      const productAId = itemsInDb[0]!.product_id;
      const productBId = itemsInDb[1]!.product_id;

      const updatedQtyA = 4;
      const originalQtyB = 3;
      const subtotalA = 100 * updatedQtyA;
      const subtotalB = 200 * originalQtyB;
      const totalPrice = subtotalA + subtotalB;
      const totalQuantity = updatedQtyA + originalQtyB;

      // Act
      const res = await sendUpdateCartItemRequest(
        cart.id,
        productAId,
        { quantity: updatedQtyA },
        token,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Item quantity updated successfully",
        data: {
          id: cart.id,
          userId: user.id,
          items: [
            {
              productId: productAId,
              name: "Product A",
              price: 100,
              quantity: updatedQtyA,
              subtotal: subtotalA,
            },
            {
              productId: productBId,
              name: "Product B",
              price: 200,
              quantity: originalQtyB,
              subtotal: subtotalB,
            },
          ],
          totalPrice,
          totalQuantity,
        },
      });
    });

    it("should return 200 when updating quantity to exact product stock", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 5 });
      const token = generateToken(user);
      const cart = await insertTestCart(user);
      await insertTestCartItem(cart.id, product.id, 1);

      // Act
      const res = await sendUpdateCartItemRequest(
        cart.id,
        product.id,
        { quantity: 5 },
        token,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data.totalQuantity).toBe(5);
      expect(res.body.data.items[0].quantity).toBe(5);
    });

    it("should persist updated quantity in the database", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const product = await insertTestProduct();
      const cart = await insertTestCart(user);
      await insertTestCartItem(cart.id, product.id, 2);

      // Act
      await sendUpdateCartItemRequest(
        cart.id,
        product.id,
        { quantity: 7 },
        token,
      );

      // Assert
      const [itemInDb] = await sql<[{ quantity: number }]>`
        SELECT quantity FROM cart_items
        WHERE cart_id = ${cart.id} AND product_id = ${product.id}
      `;
      expect(itemInDb.quantity).toBe(7);
    });
  });

  describe("Validation Errors - Schema (400 Bad Request)", () => {
    const routeParamValidationCases = [
      {
        scenario: "cart id is not a number",
        cartId: "abc",
        productId: 1,
        field: "cartId",
        message: "Cart ID is required",
      },
      {
        scenario: "cart id is a float",
        cartId: 1.5,
        productId: 1,
        field: "cartId",
        message: "Cart ID must be an integer",
      },
      {
        scenario: "cart id is zero",
        cartId: 0,
        productId: 1,
        field: "cartId",
        message: "Cart ID must be a positive integer",
      },
      {
        scenario: "cart id is negative",
        cartId: -1,
        productId: 1,
        field: "cartId",
        message: "Cart ID must be a positive integer",
      },
      {
        scenario: "product id is not a number",
        cartId: 1,
        productId: "abc",
        field: "productId",
        message: "Product ID is required",
      },
      {
        scenario: "product id is a float",
        cartId: 1,
        productId: 1.5,
        field: "productId",
        message: "Product ID must be an integer",
      },
      {
        scenario: "product id is zero",
        cartId: 1,
        productId: 0,
        field: "productId",
        message: "Product ID must be a positive integer",
      },
      {
        scenario: "product id is negative",
        cartId: 1,
        productId: -1,
        field: "productId",
        message: "Product ID must be a positive integer",
      },
    ];

    it.each(routeParamValidationCases)(
      "should return 400 when $scenario",
      async ({ cartId, productId, field, message }) => {
        // Arrange
        const user = await insertTestUser();
        const token = generateToken(user);

        // Act
        const res = await sendUpdateCartItemRequest(
          cartId,
          productId,
          { quantity: 1 },
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
              field,
              message,
            },
          ],
        });
      },
    );

    const bodyValidationCases = [
      {
        scenario: "quantity is missing",
        body: {},
        field: "quantity",
        message: "Quantity is required",
      },
      {
        scenario: "quantity is not a number",
        body: { quantity: "invalid" },
        field: "quantity",
        message: "Quantity is required",
      },
      {
        scenario: "quantity is a float",
        body: { quantity: 2.5 },
        field: "quantity",
        message: "Quantity must be an integer",
      },
      {
        scenario: "quantity is zero",
        body: { quantity: 0 },
        field: "quantity",
        message: "Quantity must be a positive integer",
      },
      {
        scenario: "quantity is negative",
        body: { quantity: -2 },
        field: "quantity",
        message: "Quantity must be a positive integer",
      },
    ];

    it.each(bodyValidationCases)(
      "should return 400 when $scenario",
      async ({ body, field, message }) => {
        // Arrange
        const user = await insertTestUser();
        const token = generateToken(user);

        // Act
        const res = await sendUpdateCartItemRequest(1, 1, body, token);

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

  describe("Validation Errors - Business Logic (400 Bad Request)", () => {
    it("should return 400 when requested quantity exceeds available stock", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 5 });
      const token = generateToken(user);
      const cart = await insertTestCart(user);
      await insertTestCartItem(cart.id, product.id, 2);

      // Act
      const res = await sendUpdateCartItemRequest(
        cart.id,
        product.id,
        { quantity: 6 },
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
            field: "quantity",
            message: "Requested quantity exceeds available stock",
          },
        ],
      });
    });

    it("should not modify cart item in database when stock validation fails", async () => {
      // Arrange
      const user = await insertTestUser();
      const product = await insertTestProduct({ stock: 5 });
      const token = generateToken(user);
      const cart = await insertTestCart(user);
      await insertTestCartItem(cart.id, product.id, 2);

      // Act
      await sendUpdateCartItemRequest(
        cart.id,
        product.id,
        { quantity: 10 },
        token,
      );

      // Assert
      const [itemInDb] = await sql<[{ quantity: number }]>`
        SELECT quantity FROM cart_items
        WHERE cart_id = ${cart.id} AND product_id = ${product.id}
      `;
      expect(itemInDb.quantity).toBe(2);
    });
  });

  describe("Authentication (401 Unauthorized)", () => {
    it("should return 401 when user is unauthenticated", async () => {
      // Act
      const res = await sendUpdateCartItemRequest(1, 1, { quantity: 1 });

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Act
      const res = await sendUpdateCartItemRequest(
        1,
        1,
        { quantity: 1 },
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
      const user = await insertTestUser();
      const expiredToken = generateToken(user, "-1s");

      // Act
      const res = await sendUpdateCartItemRequest(
        1,
        1,
        { quantity: 1 },
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
    it("should return 403 when user tries to update item in another user's cart", async () => {
      // Arrange
      const userA = await insertTestUser({ email: "userA@email.com" });
      const product = await insertTestProduct();
      const cartA = await insertTestCart(userA);
      await insertTestCartItem(cartA.id, product.id, 2);

      const userB = await insertTestUser({ email: "userB@email.com" });
      const tokenB = generateToken(userB);

      // Act
      const res = await sendUpdateCartItemRequest(
        cartA.id,
        product.id,
        { quantity: 5 },
        tokenB,
      );

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });

      // Verify item quantity was not modified
      const [itemInDb] = await sql<[{ quantity: number }]>`
        SELECT quantity FROM cart_items
        WHERE cart_id = ${cartA.id} AND product_id = ${product.id}
      `;
      expect(itemInDb.quantity).toBe(2);
    });
  });

  describe("Not Found (404 Not Found)", () => {
    it("should return 404 when cart is not found", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendUpdateCartItemRequest(
        999,
        1,
        { quantity: 1 },
        token,
      );

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Not found",
      });
    });

    it("should return 404 when item does not exist in cart", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const cart = await insertTestCart(user);
      const product = await insertTestProduct();

      // Act
      const res = await sendUpdateCartItemRequest(
        cart.id,
        product.id,
        { quantity: 1 },
        token,
      );

      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Not found",
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
      const res = await sendUpdateCartItemRequest(
        1,
        1,
        { quantity: 1 },
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
