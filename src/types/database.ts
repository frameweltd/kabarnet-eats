// Hand-authored types matching supabase/migrations/*.sql.
// If you have the Supabase CLI locally, you can regenerate these with:
//   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
// These hand-written types will work fine until you do; keep them in sync
// manually if you alter the schema without regenerating.

export type UserRole = "admin" | "hotel" | "customer" | "rider";
export type HotelStatus = "pending_approval" | "active" | "suspended";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "mpesa" | "cash";
export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
export type CommissionStatus = "pending" | "settled" | "reversed";
export type RiderAvailability = "available" | "busy" | "offline";
export type DisputeReason =
  | "not_delivered"
  | "wrong_item"
  | "quality_issue"
  | "payment_issue"
  | "other";
export type DisputeStatus =
  | "open"
  | "investigating"
  | "resolved_refunded"
  | "resolved_no_action";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

export interface Hotel {
  hotel_id: string;
  name: string;
  owner_name: string | null;
  phone: string;
  email: string | null;
  physical_address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: HotelStatus;
  commission_rate: number;
  commission_rate_effective_from: string;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  item_id: string;
  hotel_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  photo_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  customer_id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
}

export interface CustomerAddress {
  address_id: string;
  customer_id: string;
  label: string | null;
  latitude: number;
  longitude: number;
  landmark_description: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Rider {
  rider_id: string;
  name: string;
  phone: string;
  vehicle_type: string | null;
  current_latitude: number | null;
  current_longitude: number | null;
  availability_status: RiderAvailability;
  status: "active" | "suspended";
  created_at: string;
}

export interface Order {
  order_id: string;
  customer_id: string;
  hotel_id: string;
  rider_id: string | null;
  delivery_address_id: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  delivery_landmark: string | null;
  delivery_contact_phone: string | null;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  status: OrderStatus;
  commission_rate_applied: number;
  placed_at: string;
  confirmed_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface OrderItem {
  order_item_id: string;
  order_id: string;
  item_id: string;
  item_name_snapshot: string;
  price_at_order: number;
  quantity: number;
  line_total: number;
}

export interface Payment {
  payment_id: string;
  order_id: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  mpesa_receipt_number: string | null;
  mpesa_transaction_date: string | null;
  phone_number_used: string | null;
  mpesa_checkout_request_id: string | null;
  raw_callback_payload: Record<string, unknown> | null;
  created_at: string;
}

export interface CommissionRecord {
  commission_id: string;
  order_id: string;
  hotel_id: string;
  order_total: number;
  commission_rate: number;
  commission_amount: number;
  hotel_payout_amount: number;
  status: CommissionStatus;
  settlement_batch_id: string | null;
  reversed_commission_id: string | null;
  created_at: string;
  settled_at: string | null;
}

export interface SettlementBatch {
  batch_id: string;
  hotel_id: string;
  period_start: string;
  period_end: string;
  total_orders: number;
  gross_sales: number;
  total_commission: number;
  net_payout: number;
  payout_status: "pending" | "paid";
  payout_reference: string | null;
  created_at: string;
  paid_at: string | null;
}

export interface Dispute {
  dispute_id: string;
  order_id: string;
  raised_by_type: "customer" | "hotel";
  raised_by_id: string;
  reason: DisputeReason;
  description: string | null;
  status: DisputeStatus;
  resolution_note: string | null;
  resolved_by_admin_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

// Minimal Database type shape for @supabase/ssr generics.
// Loosely typed on purpose — swap in generated types when available.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
