import type { Request, Response, NextFunction } from "express";
import sql from "../db";

interface OrderItemRow {
  id: number;
  orderDate: Date;
  status: string;
  shippingAddress: string;
  paymentMethod: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
  productId: number;
  name: string;
}

interface FormattedOrderItem {
  productId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

type FormattedOrder = Pick<
  OrderItemRow,
  "id" | "status" | "shippingAddress" | "paymentMethod"
> & {
  userId: number;
  orderDate: string;
  totalPrice: number;
  totalQuantity: number;
  items: FormattedOrderItem[];
};

function formatOrders(
  orders: OrderItemRow[],
  userId: number,
): FormattedOrder[] {
  const map = new Map<number, FormattedOrder>();

  for (const order of orders) {
    const unitPrice = parseFloat(order.unitPrice);
    const subtotal = parseFloat(order.subtotal);

    const item: FormattedOrderItem = {
      name: order.name,
      unitPrice,
      quantity: order.quantity,
      productId: order.productId,
      subtotal,
    };

    const existingOrder = map.get(order.id);
    if (!existingOrder) {
      map.set(order.id, {
        userId,
        id: order.id,
        orderDate: order.orderDate.toISOString(),
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        status: order.status,
        totalPrice: subtotal,
        totalQuantity: order.quantity,
        items: [item],
      });

      continue;
    }

    existingOrder.totalPrice = Number(
      (existingOrder.totalPrice + subtotal).toFixed(2),
    );
    existingOrder.totalQuantity += order.quantity;
    existingOrder.items.push(item);
  }

  return Array.from(map.values());
}

export async function getOrdersByUserId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.userId!;

    const orders = await sql<OrderItemRow[]>`
        SELECT 
            o.id,
            o.order_date as "orderDate",
            o.status,
            o.shipping_address as "shippingAddress",
            o.payment_method as "paymentMethod",
            oi.quantity,
            oi.unit_price as "unitPrice",
            p.id as "productId",
            p.name,
            ROUND((oi.quantity * oi.unit_price)::numeric, 2) as "subtotal"
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ${userId}
        ORDER BY o.order_date DESC, oi.product_id ASC
    `;

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: formatOrders(orders, userId),
    });
  } catch (error) {
    next(error);
  }
}
