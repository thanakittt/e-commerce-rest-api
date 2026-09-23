import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/express";
import type {
  ApiEnvelope,
  CancelledOrderResponse,
  OrderDetailResponse,
} from "../types/api";
import type {
  CancelledOrderRow,
  OrderDetailRow,
  OrderStatusRow,
} from "../types/db";
import type {
  CancelOrderInput,
  UpdateOrderStatusInput,
} from "../schemas/order.schema";
import sql from "../db";

function formatOrderDetail(order: OrderDetailRow): OrderDetailResponse {
  return {
    ...order,
    totalPrice: Number(order.totalPrice).toFixed(2),
  };
}

export async function getOrdersByUserId(
  req: AuthenticatedRequest<{}, ApiEnvelope<OrderDetailResponse[]>>,
  res: Response<ApiEnvelope<OrderDetailResponse[]>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;

    const orders = await sql<OrderDetailRow[]>`
        SELECT 
            o.id,
            o.user_id as "userId",
            o.order_date as "orderDate",
            o.status,
            o.shipping_address as "shippingAddress",
            o.payment_method as "paymentMethod",
            o.cancellation_reason as "cancellationReason",
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', p.id,
                  'name', p.name,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price::text,
                  'subtotal', ROUND((oi.quantity * oi.unit_price)::numeric, 2)::text
                ) ORDER BY oi.product_id ASC
              ) FILTER (WHERE oi.product_id IS NOT NULL),
              '[]'
            ) as "items",
            COALESCE(ROUND(SUM(oi.quantity * oi.unit_price)::numeric, 2), 0) as "totalPrice",
            COALESCE(SUM(oi.quantity)::integer, 0) as "totalQuantity"
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ${userId}
        GROUP BY o.id
        ORDER BY o.order_date DESC
    `;

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: orders.map(formatOrderDetail),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAllOrders(
  _req: AuthenticatedRequest<{}, ApiEnvelope<OrderDetailResponse[]>>,
  res: Response<ApiEnvelope<OrderDetailResponse[]>>,
  next: NextFunction,
) {
  try {
    const orders = await sql<OrderDetailRow[]>`
        SELECT 
            o.id,
            o.user_id as "userId",
            o.order_date as "orderDate",
            o.status,
            o.shipping_address as "shippingAddress",
            o.payment_method as "paymentMethod",
            o.cancellation_reason as "cancellationReason",
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', p.id,
                  'name', p.name,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price::text,
                  'subtotal', ROUND((oi.quantity * oi.unit_price)::numeric, 2)::text
                ) ORDER BY oi.product_id ASC
              ) FILTER (WHERE oi.product_id IS NOT NULL),
              '[]'
            ) as "items",
            COALESCE(ROUND(SUM(oi.quantity * oi.unit_price)::numeric, 2), 0) as "totalPrice",
            COALESCE(SUM(oi.quantity)::integer, 0) as "totalQuantity"
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        GROUP BY o.id
        ORDER BY o.order_date DESC, o.id DESC
    `;

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: orders.map(formatOrderDetail),
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderById(
  req: AuthenticatedRequest<{ id: string }, ApiEnvelope<OrderDetailResponse>>,
  res: Response<ApiEnvelope<OrderDetailResponse>>,
  next: NextFunction,
) {
  try {
    const orderId = Number(req.params.id);
    const userId = req.userId;
    const userRole = req.userRole;

    const [orderDetail] = await sql<OrderDetailRow[]>`
        SELECT 
            o.id,
            o.user_id as "userId",
            o.order_date as "orderDate",
            o.status,
            o.shipping_address as "shippingAddress",
            o.payment_method as "paymentMethod",
            o.cancellation_reason as "cancellationReason",
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', p.id,
                  'name', p.name,
                  'quantity', oi.quantity,
                  'unitPrice', oi.unit_price::text,
                  'subtotal', ROUND((oi.quantity * oi.unit_price)::numeric, 2)::text
                ) ORDER BY oi.product_id ASC
              ) FILTER (WHERE oi.product_id IS NOT NULL),
              '[]'
            ) as "items",
            COALESCE(ROUND(SUM(oi.quantity * oi.unit_price)::numeric, 2), 0) as "totalPrice",
            COALESCE(SUM(oi.quantity)::integer, 0) as "totalQuantity"
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.id = ${orderId}
        GROUP BY o.id
    `;

    if (!orderDetail) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const isOwner = orderDetail.userId === userId;
    const isAdmin = userRole === "admin";
    const hasPermission = isOwner || isAdmin;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: formatOrderDetail(orderDetail),
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelOrder(
  req: AuthenticatedRequest<{ id: string }, ApiEnvelope<CancelledOrderResponse>, CancelOrderInput>,
  res: Response<ApiEnvelope<CancelledOrderResponse>>,
  next: NextFunction,
) {
  try {
    const userId = req.userId;
    const userRole = req.userRole;
    const orderId = Number(req.params.id);
    const reason = req.body.reason ?? null;

    const [order] = await sql<OrderStatusRow[]>`
      SELECT user_id as "userId", status
      FROM orders
      WHERE id = ${orderId}
    `;

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    const isOwner = order.userId === userId;
    const isAdmin = userRole === "admin";
    const hasPermission = isOwner || isAdmin;

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    const isPending = order.status === "pending";
    if (!isPending) {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be cancelled",
      });
    }

    const [updatedOrder] = await sql<CancelledOrderRow[]>`
      UPDATE orders
      SET
        status = 'cancelled',
        cancellation_reason = ${reason}
      WHERE
        id = ${orderId}
        AND status = 'pending'
      RETURNING
        id,
        status,
        cancellation_reason as "cancellationReason"
    `;

    if (!updatedOrder) {
      return res.status(400).json({
        success: false,
        message: "Only pending orders can be cancelled",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatus(
  req: AuthenticatedRequest<{ orderId: string }, ApiEnvelope<CancelledOrderResponse>, UpdateOrderStatusInput>,
  res: Response<ApiEnvelope<CancelledOrderResponse>>,
  next: NextFunction,
) {
  try {
    const orderId = Number(req.params.orderId);
    const { status, cancellationReason } = req.body;
    const reason = status === "cancelled" ? (cancellationReason ?? null) : null;

    const [updatedOrder] = await sql<CancelledOrderRow[]>`
      UPDATE orders
      SET
        status = ${status},
        cancellation_reason = ${reason}
      WHERE id = ${orderId}
      RETURNING
        id,
        status,
        cancellation_reason as "cancellationReason"
    `;

    if (!updatedOrder) {
      return res.status(404).json({
        success: false,
        message: "Not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
}
