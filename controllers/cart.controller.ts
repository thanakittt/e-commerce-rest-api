import type { NextFunction, Request, Response } from "express";
import type {
  CheckoutBodyInput,
  CheckoutParamsInput,
  CreateCartInput,
} from "../schemas/cart.schema";
import sql from "../db";

interface ProductStock {
  id: number;
  stock: number;
}

interface CartRow {
  id: number;
}

interface CartOwnerRow {
  id: number;
  user_id: number;
}

interface CartItemRow {
  id: number;
  name: string;
  price: string;
  quantity: number;
  subtotal: string;
}

interface CartItemResponse {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface CartResponse {
  id: number;
  userId: number;
  items: CartItemResponse[];
  totalPrice: number;
  totalQuantity: number;
}

function canAccessCart(
  cartUserId: number,
  userId: number,
  role: string,
): boolean {
  return cartUserId === userId || role === "admin";
}

async function findCartById(cartId: number): Promise<CartOwnerRow | undefined> {
  const [cart] = await sql<[CartOwnerRow?]>`
    SELECT id, user_id FROM carts WHERE id = ${cartId}
  `;
  return cart;
}

async function getCartItems(cartId: number): Promise<CartItemRow[]> {
  return sql<CartItemRow[]>`
    SELECT
      p.id,
      p.name,
      p.price,
      ci.quantity,
      (p.price * ci.quantity) AS subtotal
    FROM cart_items AS ci
    JOIN products AS p ON ci.product_id = p.id
    WHERE ci.cart_id = ${cartId}
    ORDER BY p.id ASC
  `;
}

function sendValidationError(res: Response, field: string, message: string) {
  return res.status(400).json({
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
}

function formatCartResponse(
  cartId: number,
  userId: number,
  cartItems: CartItemRow[],
): CartResponse {
  let totalPrice = 0;
  let totalQuantity = 0;

  const items = cartItems.map((item) => {
    const subtotal = parseFloat(item.subtotal);
    totalPrice += subtotal;
    totalQuantity += item.quantity;

    return {
      productId: item.id,
      name: item.name,
      price: parseFloat(item.price),
      quantity: item.quantity,
      subtotal,
    };
  });

  return {
    id: cartId,
    userId,
    items,
    totalPrice,
    totalQuantity,
  };
}

export async function createCart(
  req: Request<{}, {}, CreateCartInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId!;
    const { productId, quantity } = req.body;

    const [product] = await sql<[ProductStock?]>`
      SELECT id, stock FROM products WHERE id = ${productId}
    `;

    if (!product) {
      return sendValidationError(res, "productId", "Product not found");
    }

    const [existingItem] = await sql<[{ quantity: number }?]>`
      SELECT ci.quantity
      FROM carts c
      JOIN cart_items ci ON ci.cart_id = c.id
      WHERE c.user_id = ${userId} AND ci.product_id = ${productId}
    `;
    const currentQty = existingItem?.quantity ?? 0;

    if (currentQty + quantity > product.stock) {
      return sendValidationError(
        res,
        "quantity",
        "Requested quantity exceeds available stock",
      );
    }

    const [cart] = await sql<[CartRow]>`
      INSERT INTO carts (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    `;
    const cartId = cart.id;

    await sql`
      INSERT INTO cart_items (cart_id, product_id, quantity)
      VALUES (${cartId}, ${productId}, ${quantity})
      ON CONFLICT (cart_id, product_id)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
    `;

    const cartItems = await getCartItems(cartId);

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      data: formatCartResponse(cartId, userId, cartItems),
    });
  } catch (error) {
    next(error);
  }
}

export async function getCartById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;
    const cartId = Number(req.params.id);

    const cart = await findCartById(cartId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!canAccessCart(cart.user_id, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const cartItems = await getCartItems(cartId);

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: formatCartResponse(cartId, cart.user_id, cartItems),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCartById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;
    const cartId = Number(req.params.id);

    const cart = await findCartById(cartId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!canAccessCart(cart.user_id, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    await sql`
      DELETE FROM carts WHERE id = ${cartId}
    `;

    return res.status(200).json({
      success: true,
      message: "Cart deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCartItem(
  req: Request<{ cartId: string; productId: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;
    const cartId = Number(req.params.cartId);
    const productId = Number(req.params.productId);

    const cart = await findCartById(cartId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!canAccessCart(cart.user_id, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    await sql`
      DELETE FROM cart_items WHERE cart_id = ${cartId} AND product_id = ${productId}
    `;

    return res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCartItem(
  req: Request<{ cartId: string; productId: string }, {}, { quantity: number }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;
    const cartId = Number(req.params.cartId);
    const productId = Number(req.params.productId);
    const { quantity } = req.body;

    const cart = await findCartById(cartId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!canAccessCart(cart.user_id, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const [cartItem] = await sql<[{ cart_id: number; product_id: number }?]>`
      SELECT cart_id, product_id
      FROM cart_items
      WHERE cart_id = ${cartId} AND product_id = ${productId}
    `;
    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const [product] = await sql<[ProductStock?]>`
      SELECT id, stock FROM products WHERE id = ${productId}
    `;

    if (!product) {
      return sendValidationError(res, "productId", "Product not found");
    }

    if (quantity > product.stock) {
      return sendValidationError(
        res,
        "quantity",
        "Requested quantity exceeds available stock",
      );
    }

    await sql`
      UPDATE cart_items SET quantity = ${quantity} WHERE cart_id = ${cartId} AND product_id = ${productId}
    `;
    const cartItems = await getCartItems(cartId);

    return res.status(200).json({
      success: true,
      message: "Item quantity updated successfully",
      data: formatCartResponse(cartId, cart.user_id, cartItems),
    });
  } catch (error) {
    next(error);
  }
}

interface CheckoutCartItemRow {
  product_id: number;
  name: string;
  price: string;
  quantity: number;
  stock: number;
}

interface CreatedOrderRow {
  id: number;
  order_date: Date;
  status: string;
}

interface ProcessCheckoutParams {
  userId: number;
  cartId: number;
  shippingAddress: string;
  paymentMethod: string;
  cartItems: CheckoutCartItemRow[];
}

interface ProcessCheckoutResult {
  order: CreatedOrderRow;
  totalPrice: number;
  totalQuantity: number;
}

async function getCheckoutCartItems(
  cartId: number,
): Promise<CheckoutCartItemRow[]> {
  return sql<CheckoutCartItemRow[]>`
    SELECT ci.quantity, p.price, p.name, p.stock, p.id AS product_id
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.cart_id = ${cartId}
  `;
}

async function processOrderCheckout({
  userId,
  cartId,
  shippingAddress,
  paymentMethod,
  cartItems,
}: ProcessCheckoutParams): Promise<ProcessCheckoutResult> {
  return sql.begin(async (tx) => {
    const [order] = await tx<[CreatedOrderRow]>`
      INSERT INTO orders (user_id, shipping_address, payment_method)
      VALUES (${userId}, ${shippingAddress}, ${paymentMethod})
      RETURNING id, order_date, status
    `;

    const orderItems = cartItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
    }));

    await tx`
      INSERT INTO order_items ${tx(orderItems)}
    `;

    await Promise.all(
      orderItems.map(
        (item) => tx`
          UPDATE products
          SET stock = stock - ${item.quantity}
          WHERE id = ${item.product_id}
        `,
      ),
    );

    await tx`
      DELETE FROM carts WHERE id = ${cartId}
    `;

    const totalQuantity = cartItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const totalPrice = cartItems.reduce(
      (sum, item) => sum + item.quantity * Number(item.price),
      0,
    );

    return {
      order,
      totalPrice,
      totalQuantity,
    };
  });
}

function formatCheckoutResponse(
  order: CreatedOrderRow,
  userId: number,
  shippingAddress: string,
  paymentMethod: string,
  totalPrice: number,
  totalQuantity: number,
  cartItems: CheckoutCartItemRow[],
) {
  return {
    id: order.id,
    userId,
    shippingAddress,
    paymentMethod,
    orderDate: order.order_date,
    status: order.status,
    totalPrice,
    totalQuantity,
    items: cartItems.map((item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.price),
      subtotal: item.quantity * Number(item.price),
    })),
  };
}

export async function checkout(
  req: Request<{ id: string }, {}, CheckoutBodyInput>,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId!;
    const userRole = req.userRole!;
    const cartId = Number(req.params.id);
    const { shippingAddress, paymentMethod } = req.body;

    const cart = await findCartById(cartId);
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    if (!canAccessCart(cart.user_id, userId, userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const cartItems = await getCheckoutCartItems(cartId);
    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    const hasInsufficientStock = cartItems.some(
      (item) => item.quantity > item.stock,
    );
    if (hasInsufficientStock) {
      return sendValidationError(
        res,
        "quantity",
        "Requested quantity exceeds available stock",
      );
    }

    const { order, totalPrice, totalQuantity } = await processOrderCheckout({
      userId,
      cartId,
      shippingAddress,
      paymentMethod,
      cartItems,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: formatCheckoutResponse(
        order,
        userId,
        shippingAddress,
        paymentMethod,
        totalPrice,
        totalQuantity,
        cartItems,
      ),
    });
  } catch (error) {
    next(error);
  }
}
