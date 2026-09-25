import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/express";
import type {
  ApiEnvelope,
  CartResponse,
  CheckoutOrderResponse,
} from "../types/api";
import type {
  CartItemRow,
  CartOwnerRow,
  CartRow,
  CheckoutCartItemRow,
  CreatedOrderRow,
  ProductStockRow,
} from "../types/db";
import type {
  CheckoutBodyInput,
  AddToCartInput,
  UpdateCartItemBodyInput,
} from "../schemas/cart.schema";
import sql from "../db";

function canAccessCart(
  cartUserId: number,
  userId: number,
  role: string,
): boolean {
  return cartUserId === userId || role === "admin";
}

async function findCartById(cartId: number): Promise<CartOwnerRow | undefined> {
  const [cart] = await sql<CartOwnerRow[]>`
    SELECT id, user_id FROM carts WHERE id = ${cartId}
  `;
  return cart;
}

async function getCartDetails(
  cartId: number,
): Promise<CartResponse | undefined> {
  const [cart] = await sql<CartResponse[]>`
    SELECT
      c.id as "id",
      c.user_id as "userId",
      COALESCE(
        json_agg(
          json_build_object(
            'productId', p.id,
            'name', p.name,
            'price', p.price::text,
            'quantity', ci.quantity,
            'subtotal', (p.price * ci.quantity)::text
          ) ORDER BY p.id ASC
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'::json
      ) as "items",
      COALESCE(ROUND(SUM(p.price * ci.quantity)::numeric, 2)::text, '0.00') as "totalPrice",
      COALESCE(SUM(ci.quantity), 0)::integer as "totalQuantity"
    FROM carts c
    LEFT JOIN cart_items ci ON c.id = ci.cart_id
    LEFT JOIN products p ON ci.product_id = p.id
    WHERE c.id = ${cartId}
    GROUP BY c.id, c.user_id
  `;
  return cart;
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

export async function addToCart(
  req: AuthenticatedRequest<{}, ApiEnvelope<CartResponse>, AddToCartInput>,
  res: Response<ApiEnvelope<CartResponse>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const { productId, quantity } = req.body;

    const [product] = await sql<ProductStockRow[]>`
      SELECT id, stock FROM products WHERE id = ${productId}
    `;

    if (!product) {
      return sendValidationError(res, "productId", "Product not found");
    }

    const [existingItem] = await sql<Pick<CartItemRow, "quantity">[]>`
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

    const [cart] = await sql<Pick<CartRow, "id">[]>`
      INSERT INTO carts (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    `;

    if (!cart) {
      return res.status(500).json({
        success: false,
        message: "Failed to create cart",
      });
    }

    const cartId = cart.id;

    await sql<CartItemRow[]>`
      INSERT INTO cart_items (cart_id, product_id, quantity)
      VALUES (${cartId}, ${productId}, ${quantity})
      ON CONFLICT (cart_id, product_id)
      DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity
    `;

    const cartDetails = await getCartDetails(cartId);

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
      data: cartDetails!,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCartById(
  req: AuthenticatedRequest<{ id: string }, ApiEnvelope<CartResponse>>,
  res: Response<ApiEnvelope<CartResponse>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
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

    const cartDetails = await getCartDetails(cartId);

    return res.status(200).json({
      success: true,
      message: "Cart fetched successfully",
      data: cartDetails!,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCartById(
  req: AuthenticatedRequest<{ id: string }, ApiEnvelope<void>>,
  res: Response<ApiEnvelope<void>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
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

    await sql<CartRow[]>`
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
  req: AuthenticatedRequest<
    { cartId: string; productId: string },
    ApiEnvelope<void>
  >,
  res: Response<ApiEnvelope<void>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
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

    await sql<CartItemRow[]>`
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
  req: AuthenticatedRequest<
    { cartId: string; productId: string },
    ApiEnvelope<CartResponse>,
    UpdateCartItemBodyInput
  >,
  res: Response<ApiEnvelope<CartResponse>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
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

    const [cartItem] = await sql<Pick<CartItemRow, "cart_id" | "product_id">[]>`
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

    const [product] = await sql<ProductStockRow[]>`
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

    await sql<CartItemRow[]>`
      UPDATE cart_items SET quantity = ${quantity} WHERE cart_id = ${cartId} AND product_id = ${productId}
    `;
    const cartDetails = await getCartDetails(cartId);

    return res.status(200).json({
      success: true,
      message: "Item quantity updated successfully",
      data: cartDetails!,
    });
  } catch (error) {
    next(error);
  }
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
    const [order] = await tx<CreatedOrderRow[]>`
      INSERT INTO orders (user_id, shipping_address, payment_method)
      VALUES (${userId}, ${shippingAddress}, ${paymentMethod})
      RETURNING id, order_date, status
    `;

    if (!order) {
      throw new Error("Failed to create order");
    }

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
): CheckoutOrderResponse {
  return {
    id: order.id,
    userId,
    shippingAddress,
    paymentMethod,
    orderDate: order.order_date,
    status: order.status,
    totalPrice: totalPrice.toFixed(2),
    totalQuantity,
    items: cartItems.map((item) => ({
      productId: item.product_id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: Number(item.price).toFixed(2),
      subtotal: (item.quantity * Number(item.price)).toFixed(2),
    })),
  };
}

export async function checkout(
  req: AuthenticatedRequest<
    { id: string },
    ApiEnvelope<CheckoutOrderResponse>,
    CheckoutBodyInput
  >,
  res: Response<ApiEnvelope<CheckoutOrderResponse>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
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
