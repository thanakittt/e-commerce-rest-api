import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  mock,
  spyOn,
} from "bun:test";
import sql, * as db from "../db";
import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app";

// --- Types & Interfaces ---
interface TestUser {
  id: number;
  role: "user" | "admin";
}

interface TestOrder {
  id: number;
  userId: number;
  status: "pending" | "paid" | "shipped" | "cancelled";
  shippingAddress: string;
  paymentMethod: "credit_card" | "paypal" | "bank_transfer";
  orderDate: Date;
}

interface TestOrderItem {
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
}

interface TestProduct {
  id: number;
  name: string;
  price: number;
  stock: number;
}

// --- Test Helpers & Factories ---
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

const insertTestOrder = async (
  user: Pick<TestUser, "id">,
  overrides: Partial<{
    status: "pending" | "paid" | "shipped" | "cancelled";
    shippingAddress: string;
    paymentMethod: "credit_card" | "paypal" | "bank_transfer";
    orderDate: Date;
  }> = {},
): Promise<TestOrder> => {
  const payload: Record<string, unknown> = {
    user_id: user.id,
    status: overrides.status ?? "pending",
    shipping_address: overrides.shippingAddress ?? "123 Main St",
    payment_method: overrides.paymentMethod ?? "credit_card",
  };
  if (overrides.orderDate) {
    payload.order_date = overrides.orderDate;
  }
  const [order] = await sql<[TestOrder]>`
    INSERT INTO orders ${sql(payload)}
    RETURNING id, user_id as "userId", status, shipping_address as "shippingAddress", payment_method as "paymentMethod", order_date as "orderDate"
  `;
  return order;
};

const insertTestOrderItem = async (
  orderId: number,
  productId: number,
  quantity: number,
  unitPrice: number,
): Promise<TestOrderItem> => {
  const [orderItem] = await sql<[TestOrderItem]>`
    INSERT INTO order_items (order_id, product_id, quantity, unit_price)
    VALUES (${orderId}, ${productId}, ${quantity}, ${unitPrice})
    RETURNING order_id AS "orderId", product_id AS "productId", quantity, unit_price AS "unitPrice"
  `;
  return orderItem;
};

const sendGetOrdersRequest = async (
  tokenOrHeader?: string,
  rawHeader = false,
) => {
  const req = request(app).get("/api/orders");
  if (!tokenOrHeader) return req;
  const headerValue = rawHeader ? tokenOrHeader : `Bearer ${tokenOrHeader}`;
  return req.set("Authorization", headerValue);
};

const sendGetOrderByIdRequest = async (
  id: string | number,
  tokenOrHeader?: string,
  rawHeader = false,
) => {
  const req = request(app).get(`/api/orders/${id}`);
  if (!tokenOrHeader) return req;
  const headerValue = rawHeader ? tokenOrHeader : `Bearer ${tokenOrHeader}`;
  return req.set("Authorization", headerValue);
};

const mockDatabaseError = () => {
  spyOn(db, "default").mockRejectedValue(new Error("Simulated database error"));
  spyOn(console, "error").mockImplementation(() => {});
};

const toOrderResponse = (
  orderId: number,
  userId: number,
  status: string,
  shippingAddress: string,
  paymentMethod: string,
  orderDate: Date,
  totalPrice: number,
  totalQuantity: number,
) => {
  return {
    id: orderId,
    userId,
    status,
    shippingAddress,
    paymentMethod,
    orderDate: orderDate.toISOString(),
    totalPrice: totalPrice.toFixed(2),
    totalQuantity,
  };
};

const toOrderItemResponse = (
  productId: number,
  name: string,
  quantity: number,
  unitPrice: string,
  subtotal: number,
) => {
  return {
    productId,
    name,
    quantity,
    unitPrice: parseFloat(unitPrice).toFixed(2),
    subtotal: subtotal.toFixed(2),
  };
};

const toOrderDetailResponse = (
  order: TestOrder,
  totalPrice: number,
  totalQuantity: number,
  items: ReturnType<typeof toOrderItemResponse>[] = [],
) => {
  return {
    ...toOrderResponse(
      order.id,
      order.userId,
      order.status,
      order.shippingAddress,
      order.paymentMethod,
      order.orderDate,
      totalPrice,
      totalQuantity,
    ),
    items,
  };
};

// --- Lifecycle Hooks ---
beforeEach(async () => {
  await sql`TRUNCATE TABLE users, products, orders, order_items RESTART IDENTITY CASCADE`;
});

afterEach(() => {
  mock.restore();
});

// --- Test Suites ---
describe("GET /api/orders", () => {
  describe("Success Cases (200 OK)", () => {
    it("should return 200 with empty array when user has no orders", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendGetOrdersRequest(token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Orders fetched successfully",
        data: [],
      });
    });

    it("should return 200 with all orders and aggregated totals for authenticated user", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      const order1 = await insertTestOrder(user, {
        orderDate: new Date("2026-01-01T10:00:00.000Z"),
      });
      const order2 = await insertTestOrder(user, {
        orderDate: new Date("2026-01-02T10:00:00.000Z"),
      });

      const productA = await insertTestProduct({
        name: "Product A",
        price: 100,
      });
      const productB = await insertTestProduct({
        name: "Product B",
        price: 50,
      });

      // Order 1 items
      const orderItem1A = await insertTestOrderItem(
        order1.id,
        productA.id,
        1,
        productA.price,
      );
      const orderItem1B = await insertTestOrderItem(
        order1.id,
        productB.id,
        2,
        productB.price,
      );

      // Order 2 items
      const orderItem2A = await insertTestOrderItem(
        order2.id,
        productA.id,
        3,
        productA.price,
      );
      const orderItem2B = await insertTestOrderItem(
        order2.id,
        productB.id,
        1,
        productB.price,
      );

      const subtotal1A = orderItem1A.quantity * Number(orderItem1A.unitPrice);
      const subtotal1B = orderItem1B.quantity * Number(orderItem1B.unitPrice);
      const totalPrice1 = subtotal1A + subtotal1B;
      const totalQuantity1 = orderItem1A.quantity + orderItem1B.quantity;

      const subtotal2A = orderItem2A.quantity * Number(orderItem2A.unitPrice);
      const subtotal2B = orderItem2B.quantity * Number(orderItem2B.unitPrice);
      const totalPrice2 = subtotal2A + subtotal2B;
      const totalQuantity2 = orderItem2A.quantity + orderItem2B.quantity;

      // Act
      const res = await sendGetOrdersRequest(token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Orders fetched successfully",
        data: [
          {
            id: order2.id,
            userId: user.id,
            shippingAddress: order2.shippingAddress,
            paymentMethod: order2.paymentMethod,
            status: order2.status,
            totalPrice: totalPrice2.toFixed(2),
            totalQuantity: totalQuantity2,
            orderDate: order2.orderDate.toISOString(),
            items: [
              {
                productId: productA.id,
                name: productA.name,
                unitPrice: productA.price.toFixed(2),
                quantity: orderItem2A.quantity,
                subtotal: subtotal2A.toFixed(2),
              },
              {
                productId: productB.id,
                name: productB.name,
                unitPrice: productB.price.toFixed(2),
                quantity: orderItem2B.quantity,
                subtotal: subtotal2B.toFixed(2),
              },
            ],
          },
          {
            id: order1.id,
            userId: user.id,
            shippingAddress: order1.shippingAddress,
            paymentMethod: order1.paymentMethod,
            status: order1.status,
            totalPrice: totalPrice1.toFixed(2),
            totalQuantity: totalQuantity1,
            orderDate: order1.orderDate.toISOString(),
            items: [
              {
                productId: productA.id,
                name: productA.name,
                unitPrice: productA.price.toFixed(2),
                quantity: orderItem1A.quantity,
                subtotal: subtotal1A.toFixed(2),
              },
              {
                productId: productB.id,
                name: productB.name,
                unitPrice: productB.price.toFixed(2),
                quantity: orderItem1B.quantity,
                subtotal: subtotal1B.toFixed(2),
              },
            ],
          },
        ],
      });
    });

    it("should return orders sorted by orderDate DESC and items sorted by productId ASC", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      const olderDate = new Date("2026-01-01T00:00:00.000Z");
      const newerDate = new Date("2026-02-01T00:00:00.000Z");

      const olderOrder = await insertTestOrder(user, { orderDate: olderDate });
      const newerOrder = await insertTestOrder(user, { orderDate: newerDate });

      const productLowId = await insertTestProduct({
        name: "Low ID Product",
        price: 10,
      });
      const productHighId = await insertTestProduct({
        name: "High ID Product",
        price: 20,
      });

      // Insert items with high ID first to verify ASC order
      await insertTestOrderItem(
        olderOrder.id,
        productHighId.id,
        1,
        productHighId.price,
      );
      await insertTestOrderItem(
        olderOrder.id,
        productLowId.id,
        1,
        productLowId.price,
      );

      await insertTestOrderItem(
        newerOrder.id,
        productHighId.id,
        2,
        productHighId.price,
      );
      await insertTestOrderItem(
        newerOrder.id,
        productLowId.id,
        1,
        productLowId.price,
      );

      // Act
      const res = await sendGetOrdersRequest(token);

      // Assert
      expect(res.status).toBe(200);
      const orders = res.body.data;
      expect(orders).toHaveLength(2);

      // Verify orders order: newer first
      expect(orders[0].id).toBe(newerOrder.id);
      expect(orders[1].id).toBe(olderOrder.id);

      // Verify items order: low product ID first
      expect(orders[0].items[0].productId).toBe(productLowId.id);
      expect(orders[0].items[1].productId).toBe(productHighId.id);
      expect(orders[1].items[0].productId).toBe(productLowId.id);
      expect(orders[1].items[1].productId).toBe(productHighId.id);
    });

    it("should isolate orders and return only the authenticated user's orders", async () => {
      // Arrange
      const userA = await insertTestUser({ email: "userA@email.com" });
      const userB = await insertTestUser({ email: "userB@email.com" });
      const tokenA = generateToken(userA);

      const product = await insertTestProduct({ price: 100 });

      const orderA = await insertTestOrder(userA);
      await insertTestOrderItem(orderA.id, product.id, 1, product.price);

      const orderB = await insertTestOrder(userB);
      await insertTestOrderItem(orderB.id, product.id, 2, product.price);

      // Act
      const res = await sendGetOrdersRequest(tokenA);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(orderA.id);
      expect(res.body.data[0].userId).toBe(userA.id);
    });

    it("should correctly calculate totalPrice and subtotal with decimal unit prices", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      const productA = await insertTestProduct({
        name: "Product A",
        price: 19.99,
      });
      const productB = await insertTestProduct({
        name: "Product B",
        price: 9.95,
      });

      const order = await insertTestOrder(user);
      // 3 * 19.99 = 59.97
      await insertTestOrderItem(order.id, productA.id, 3, 19.99);
      // 2 * 9.95 = 19.90
      await insertTestOrderItem(order.id, productB.id, 2, 9.95);

      // Act
      const res = await sendGetOrdersRequest(token);

      // Assert
      expect(res.status).toBe(200);
      const orderData = res.body.data[0];
      expect(orderData.totalPrice).toBe("79.87");
      expect(orderData.totalQuantity).toBe(5);
      expect(orderData.items[0].subtotal).toBe("59.97");
      expect(orderData.items[0].unitPrice).toBe("19.99");
      expect(orderData.items[1].subtotal).toBe("19.90");
      expect(orderData.items[1].unitPrice).toBe("9.95");
    });

    it("should correctly handle various order statuses and payment methods", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const product = await insertTestProduct({ price: 50 });

      const paidOrder = await insertTestOrder(user, {
        status: "paid",
        paymentMethod: "paypal",
        shippingAddress: "456 Sukhumvit Rd",
        orderDate: new Date("2026-01-01T00:00:00.000Z"),
      });
      await insertTestOrderItem(paidOrder.id, product.id, 1, product.price);

      const shippedOrder = await insertTestOrder(user, {
        status: "shipped",
        paymentMethod: "bank_transfer",
        shippingAddress: "789 Silom Rd",
        orderDate: new Date("2026-01-02T00:00:00.000Z"),
      });
      await insertTestOrderItem(shippedOrder.id, product.id, 2, product.price);

      const cancelledOrder = await insertTestOrder(user, {
        status: "cancelled",
        paymentMethod: "credit_card",
        shippingAddress: "101 Rama 9 Rd",
        orderDate: new Date("2026-01-03T00:00:00.000Z"),
      });
      await insertTestOrderItem(
        cancelledOrder.id,
        product.id,
        1,
        product.price,
      );

      // Act
      const res = await sendGetOrdersRequest(token);

      // Assert
      expect(res.status).toBe(200);
      const orders = res.body.data;
      expect(orders).toHaveLength(3);

      expect(orders[0].status).toBe("cancelled");
      expect(orders[0].paymentMethod).toBe("credit_card");
      expect(orders[0].shippingAddress).toBe("101 Rama 9 Rd");

      expect(orders[1].status).toBe("shipped");
      expect(orders[1].paymentMethod).toBe("bank_transfer");
      expect(orders[1].shippingAddress).toBe("789 Silom Rd");

      expect(orders[2].status).toBe("paid");
      expect(orders[2].paymentMethod).toBe("paypal");
      expect(orders[2].shippingAddress).toBe("456 Sukhumvit Rd");
    });

    it("should not return orders that have no order items", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Order with no items
      await insertTestOrder(user);

      // Act
      const res = await sendGetOrdersRequest(token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data).toStrictEqual([]);
    });
  });

  describe("Authentication & Authorization (401 Unauthorized)", () => {
    it("should return 401 when Authorization header is missing", async () => {
      // Act
      const res = await sendGetOrdersRequest();

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
      const res = await sendGetOrdersRequest(`Basic ${token}`, true);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Act
      const res = await sendGetOrdersRequest("invalid.token.here");

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
      const res = await sendGetOrdersRequest(expiredToken);

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
      const res = await sendGetOrdersRequest(token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});

describe("GET /api/orders/{id}", () => {
  describe("Success Cases (200 OK)", () => {
    it("should return 200 and order data when user requests their own order", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const order = await insertTestOrder(user);
      const productA = await insertTestProduct({
        name: "Product A",
        price: 300.0,
      });
      const productB = await insertTestProduct({
        name: "Product B",
        price: 300.0,
      });
      const itemA = await insertTestOrderItem(
        order.id,
        productA.id,
        1,
        productA.price,
      );
      const itemB = await insertTestOrderItem(
        order.id,
        productB.id,
        2,
        productB.price,
      );

      const subtotalA = itemA.quantity * parseFloat(itemA.unitPrice);
      const subtotalB = itemB.quantity * parseFloat(itemB.unitPrice);
      const totalPrice = subtotalA + subtotalB;
      const totalQuantity = itemA.quantity + itemB.quantity;

      // Act
      const res = await sendGetOrderByIdRequest(order.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Order fetched successfully",
        data: toOrderDetailResponse(order, totalPrice, totalQuantity, [
          toOrderItemResponse(
            itemA.productId,
            productA.name,
            itemA.quantity,
            itemA.unitPrice,
            subtotalA,
          ),
          toOrderItemResponse(
            itemB.productId,
            productB.name,
            itemB.quantity,
            itemB.unitPrice,
            subtotalB,
          ),
        ]),
      });
    });

    it("should return 200 with empty items array and zero totals when order has no items", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const order = await insertTestOrder(user);

      // Act
      const res = await sendGetOrderByIdRequest(order.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Order fetched successfully",
        data: toOrderDetailResponse(order, 0, 0, []),
      });
    });

    it("should return 200 when admin requests another user's order", async () => {
      // Arrange
      const regularUser = await insertTestUser({ role: "user" });
      const admin = await insertTestUser({ role: "admin" });
      const adminToken = generateToken(admin);
      const order = await insertTestOrder(regularUser);
      const product = await insertTestProduct({ price: 150.0 });
      const item = await insertTestOrderItem(
        order.id,
        product.id,
        2,
        product.price,
      );
      const subtotal = item.quantity * parseFloat(item.unitPrice);

      // Act
      const res = await sendGetOrderByIdRequest(order.id, adminToken);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toStrictEqual({
        success: true,
        message: "Order fetched successfully",
        data: toOrderDetailResponse(order, subtotal, item.quantity, [
          toOrderItemResponse(
            item.productId,
            product.name,
            item.quantity,
            item.unitPrice,
            subtotal,
          ),
        ]),
      });
    });

    it("should return items sorted by product_id ASC", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const order = await insertTestOrder(user);

      const product1 = await insertTestProduct({
        name: "Product 1",
        price: 100,
      });
      const product2 = await insertTestProduct({
        name: "Product 2",
        price: 200,
      });

      // Insert product 2 item first, then product 1 item
      await insertTestOrderItem(
        order.id,
        product2.id,
        1,
        product2.price,
      );
      await insertTestOrderItem(
        order.id,
        product1.id,
        1,
        product1.price,
      );

      // Act
      const res = await sendGetOrderByIdRequest(order.id, token);

      // Assert
      expect(res.status).toBe(200);
      expect(res.body.data.items[0].productId).toBe(product1.id);
      expect(res.body.data.items[1].productId).toBe(product2.id);
    });
  });

  describe("Validation Errors - Params (400)", () => {
    const idValidationCases = [
      {
        scenario: "id is not a number",
        id: "abc",
        message: "Order ID is required",
      },
      {
        scenario: "id is not an integer",
        id: "1.5",
        message: "Order ID must be an integer",
      },
      {
        scenario: "id is zero",
        id: "0",
        message: "Order ID must be a positive integer",
      },
      {
        scenario: "id is negative",
        id: "-1",
        message: "Order ID must be a positive integer",
      },
    ];

    it.each(idValidationCases)(
      "should return 400 when $scenario",
      async ({ id, message }) => {
        // Arrange
        const user = await insertTestUser();
        const token = generateToken(user);

        // Act
        const res = await sendGetOrderByIdRequest(id, token);

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

  describe("Authentication & Authorization (401 Unauthorized)", () => {
    it("should return 401 when Authorization header is missing", async () => {
      // Act
      const res = await sendGetOrderByIdRequest(1);

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
      const res = await sendGetOrderByIdRequest(1, `Basic ${token}`, true);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });

    it("should return 401 when token is invalid", async () => {
      // Act
      const res = await sendGetOrderByIdRequest(1, "invalid.token.here");

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
      const res = await sendGetOrderByIdRequest(1, expiredToken);

      // Assert
      expect(res.status).toBe(401);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Unauthorized",
      });
    });
  });

  describe("Forbidden (403 Forbidden)", () => {
    it("should return 403 when user tries to access another user's order", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);
      const anotherUser = await insertTestUser({ name: "Another User" });
      const anotherOrder = await insertTestOrder(anotherUser);

      // Act
      const res = await sendGetOrderByIdRequest(anotherOrder.id, token);

      // Assert
      expect(res.status).toBe(403);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Forbidden",
      });
    });
  });

  describe("Not Found (404 Not Found)", () => {
    it("should return 404 when order does not exist", async () => {
      // Arrange
      const user = await insertTestUser();
      const token = generateToken(user);

      // Act
      const res = await sendGetOrderByIdRequest(999999, token);

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
      const res = await sendGetOrderByIdRequest(1, token);

      // Assert
      expect(res.status).toBe(500);
      expect(res.body).toStrictEqual({
        success: false,
        message: "Internal server error",
      });
    });
  });
});
