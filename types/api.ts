import type { UserRole } from "./db";

export interface ApiResponse<T = void> {
  success: true;
  message: string;
  data?: T;
}

export interface ApiValidationError {
  location: string;
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  errors?: ApiValidationError[];
}

export type ApiEnvelope<T = void> = ApiResponse<T> | ApiErrorResponse;

export interface AuthTokenResponse {
  token: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole | string;
}

export interface UserRoleResponse {
  id: number;
  role: UserRole | string;
}

export interface CategoryResponse {
  id: number;
  name: string;
}

export interface ProductResponse {
  id: number;
  name: string;
  description: string | null;
  price: string;
  stock: number;
  categoryId: number | null;
}

export interface CartItemResponse {
  productId: number;
  name: string;
  price: string;
  quantity: number;
  subtotal: string;
}

export interface CartResponse {
  id: number;
  userId: number;
  items: CartItemResponse[];
  totalPrice: string;
  totalQuantity: number;
}

export interface OrderItemResponse {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export interface OrderDetailResponse {
  id: number;
  userId: number;
  orderDate: Date;
  status: string;
  shippingAddress: string;
  paymentMethod: string;
  cancellationReason: string | null;
  items: OrderItemResponse[];
  totalPrice: string;
  totalQuantity: number;
}

export interface CancelledOrderResponse {
  id: number;
  status: string;
  cancellationReason: string | null;
}

export interface CheckoutOrderResponse {
  id: number;
  userId: number;
  shippingAddress: string;
  paymentMethod: string;
  orderDate: Date;
  status: string;
  totalPrice: string;
  totalQuantity: number;
  items: OrderItemResponse[];
}
