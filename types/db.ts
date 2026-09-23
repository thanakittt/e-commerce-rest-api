export type UserRole = "user" | "admin";
export type OrderStatus = "pending" | "paid" | "shipped" | "cancelled";
export type PaymentMethod = "credit_card" | "paypal" | "bank_transfer";

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string | null;
}

export type SafeUserRow = Omit<UserRow, "password">;
export type UserRoleRow = Pick<UserRow, "id" | "role">;
export type AuthRegisterRow = Pick<UserRow, "id" | "name" | "email" | "phone">;
export type AuthLoginRow = Pick<UserRow, "id" | "password" | "role">;

export interface CategoryRow {
  id: number;
  name: string;
}

export interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  category_id: number | null;
}

export type ProductStockRow = Pick<ProductRow, "id" | "stock">;

export interface CartRow {
  id: number;
  user_id: number;
  created_at: Date;
}

export type CartOwnerRow = Pick<CartRow, "id" | "user_id">;

export interface CartItemRow {
  cart_id: number;
  product_id: number;
  quantity: number;
}

export interface CartItemDetailRow {
  id: number;
  name: string;
  price: string;
  quantity: number;
  subtotal: string;
}

export interface CheckoutCartItemRow {
  product_id: number;
  name: string;
  price: string;
  quantity: number;
  stock: number;
}

export interface OrderRow {
  id: number;
  order_date: Date;
  status: OrderStatus;
  user_id: number;
  shipping_address: string;
  payment_method: PaymentMethod;
  cancellation_reason: string | null;
}

export type CreatedOrderRow = Pick<OrderRow, "id" | "order_date" | "status">;

export interface OrderItemRow {
  order_id: number;
  product_id: number;
  quantity: number;
  unit_price: string;
}

export interface FormattedOrderItemRow {
  productId: number;
  name: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
}

export interface OrderDetailRow {
  id: number;
  userId: number;
  orderDate: Date;
  status: string;
  shippingAddress: string;
  paymentMethod: string;
  cancellationReason: string | null;
  items: FormattedOrderItemRow[];
  totalPrice: string;
  totalQuantity: number;
}

export interface OrderStatusRow {
  userId: number;
  status: string;
}

export interface CancelledOrderRow {
  id: number;
  status: string;
  cancellationReason: string | null;
}
