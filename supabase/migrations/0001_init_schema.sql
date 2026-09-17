-- ============================================================================
-- Kabarnet Eats — Initial Schema
-- Food delivery marketplace: Hotels/Restaurants + Customers + Riders + Admin
-- ============================================================================

-- Enable UUID generation (Supabase has pgcrypto available by default)
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- PROFILES
-- Supabase auth.users holds login credentials. We keep a `profiles` table
-- keyed on auth.users.id to store role + shared display info. Role-specific
-- tables (hotels, customers, riders) also key off auth.users.id directly so
-- each role's table IS the profile for that role — no separate join needed.
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'hotel', 'customer', 'rider');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name varchar(150),
  phone varchar(20),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- HOTELS
-- ----------------------------------------------------------------------------
create type hotel_status as enum ('pending_approval', 'active', 'suspended');

create table hotels (
  hotel_id uuid primary key references auth.users(id) on delete cascade,
  name varchar(150) not null,
  owner_name varchar(100),
  phone varchar(20) not null unique,
  email varchar(150),
  physical_address text,
  latitude decimal(9,6),
  longitude decimal(9,6),
  status hotel_status not null default 'pending_approval',
  commission_rate decimal(5,2) not null default 10.00,
  commission_rate_effective_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_hotels_status on hotels(status);

-- Audit trail for commission rate changes (never overwrite silently)
create table hotel_commission_history (
  history_id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(hotel_id) on delete cascade,
  old_rate decimal(5,2),
  new_rate decimal(5,2) not null,
  changed_by_admin_id uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  note text
);

create index idx_commission_history_hotel on hotel_commission_history(hotel_id, changed_at desc);

-- ----------------------------------------------------------------------------
-- MENU ITEMS
-- ----------------------------------------------------------------------------
create table menu_items (
  item_id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(hotel_id) on delete cascade,
  name varchar(150) not null,
  description text,
  price decimal(10,2) not null check (price >= 0),
  category varchar(50),
  photo_url varchar(255),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_menu_items_hotel_available on menu_items(hotel_id, is_available);

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create table customers (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  name varchar(100) not null,
  phone varchar(20) not null unique,
  email varchar(150),
  created_at timestamptz not null default now()
);

create table customer_addresses (
  address_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(customer_id) on delete cascade,
  label varchar(50),
  latitude decimal(9,6) not null,
  longitude decimal(9,6) not null,
  landmark_description text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_addresses_customer on customer_addresses(customer_id);

-- ----------------------------------------------------------------------------
-- RIDERS (optional layer — orders can also carry a plain contact phone)
-- ----------------------------------------------------------------------------
create type rider_availability as enum ('available', 'busy', 'offline');
create type rider_status as enum ('active', 'suspended');

create table riders (
  rider_id uuid primary key references auth.users(id) on delete cascade,
  name varchar(100) not null,
  phone varchar(20) not null unique,
  vehicle_type varchar(30),
  current_latitude decimal(9,6),
  current_longitude decimal(9,6),
  availability_status rider_availability not null default 'offline',
  status rider_status not null default 'active',
  created_at timestamptz not null default now()
);

create index idx_riders_availability on riders(availability_status, status);

-- ----------------------------------------------------------------------------
-- ORDERS
-- ----------------------------------------------------------------------------
create type order_status as enum (
  'pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'
);

create table orders (
  order_id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(customer_id),
  hotel_id uuid not null references hotels(hotel_id),
  rider_id uuid references riders(rider_id),
  delivery_address_id uuid references customer_addresses(address_id),
  delivery_latitude decimal(9,6),
  delivery_longitude decimal(9,6),
  delivery_landmark text,
  delivery_contact_phone varchar(20), -- fallback when no rider-table integration used
  subtotal decimal(10,2) not null check (subtotal >= 0),
  delivery_fee decimal(10,2) not null default 0 check (delivery_fee >= 0),
  total_amount decimal(10,2) not null check (total_amount >= 0),
  status order_status not null default 'pending',
  commission_rate_applied decimal(5,2) not null,
  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text
);

create index idx_orders_hotel_status on orders(hotel_id, status);
create index idx_orders_customer_placed on orders(customer_id, placed_at desc);
create index idx_orders_rider_status on orders(rider_id, status);

-- ----------------------------------------------------------------------------
-- ORDER ITEMS
-- ----------------------------------------------------------------------------
create table order_items (
  order_item_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(order_id) on delete cascade,
  item_id uuid not null references menu_items(item_id),
  item_name_snapshot varchar(150) not null,
  price_at_order decimal(10,2) not null check (price_at_order >= 0),
  quantity int not null check (quantity > 0),
  line_total decimal(10,2) not null check (line_total >= 0)
);

create index idx_order_items_order on order_items(order_id);

-- ----------------------------------------------------------------------------
-- PAYMENTS
-- ----------------------------------------------------------------------------
create type payment_method as enum ('mpesa', 'cash');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');

create table payments (
  payment_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(order_id) on delete cascade,
  method payment_method not null,
  amount decimal(10,2) not null check (amount >= 0),
  status payment_status not null default 'pending',
  mpesa_receipt_number varchar(50),
  mpesa_transaction_date timestamptz,
  phone_number_used varchar(20),
  mpesa_checkout_request_id varchar(100),
  raw_callback_payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_payments_order on payments(order_id);
create index idx_payments_mpesa_receipt on payments(mpesa_receipt_number);
create index idx_payments_checkout_request on payments(mpesa_checkout_request_id);

-- ----------------------------------------------------------------------------
-- COMMISSION RECORDS
-- ----------------------------------------------------------------------------
create type commission_status as enum ('pending', 'settled', 'reversed');

create table commission_records (
  commission_id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(order_id),
  hotel_id uuid not null references hotels(hotel_id),
  order_total decimal(10,2) not null,
  commission_rate decimal(5,2) not null,
  commission_amount decimal(10,2) not null,
  hotel_payout_amount decimal(10,2) not null,
  status commission_status not null default 'pending',
  settlement_batch_id uuid, -- FK added after settlement_batches is created
  reversed_commission_id uuid references commission_records(commission_id),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index idx_commission_hotel_status on commission_records(hotel_id, status);
create index idx_commission_created on commission_records(created_at);

-- ----------------------------------------------------------------------------
-- SETTLEMENT BATCHES (payout runs)
-- ----------------------------------------------------------------------------
create type settlement_payout_status as enum ('pending', 'paid');

create table settlement_batches (
  batch_id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(hotel_id),
  period_start date not null,
  period_end date not null,
  total_orders int not null default 0,
  gross_sales decimal(10,2) not null default 0,
  total_commission decimal(10,2) not null default 0,
  net_payout decimal(10,2) not null default 0,
  payout_status settlement_payout_status not null default 'pending',
  payout_reference varchar(100),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index idx_settlement_hotel on settlement_batches(hotel_id, period_start desc);

alter table commission_records
  add constraint fk_commission_batch
  foreign key (settlement_batch_id) references settlement_batches(batch_id);

-- ----------------------------------------------------------------------------
-- ORDER STATUS LOGS
-- ----------------------------------------------------------------------------
create table order_status_logs (
  log_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(order_id) on delete cascade,
  old_status order_status,
  new_status order_status not null,
  changed_by_type varchar(20), -- 'hotel' | 'rider' | 'customer' | 'admin' | 'system'
  changed_by_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index idx_status_logs_order on order_status_logs(order_id, created_at);

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table notifications (
  notification_id uuid primary key default gen_random_uuid(),
  recipient_type varchar(20) not null, -- 'customer' | 'hotel' | 'rider'
  recipient_id uuid not null,
  order_id uuid references orders(order_id),
  channel varchar(20) default 'in_app',
  message text not null,
  is_read boolean not null default false,
  sent_at timestamptz not null default now()
);

create index idx_notifications_recipient on notifications(recipient_type, recipient_id, is_read);

-- ----------------------------------------------------------------------------
-- DISPUTES
-- ----------------------------------------------------------------------------
create type dispute_reason as enum ('not_delivered', 'wrong_item', 'quality_issue', 'payment_issue', 'other');
create type dispute_status as enum ('open', 'investigating', 'resolved_refunded', 'resolved_no_action');

create table disputes (
  dispute_id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(order_id),
  raised_by_type varchar(20) not null, -- 'customer' | 'hotel'
  raised_by_id uuid not null,
  reason dispute_reason not null,
  description text,
  status dispute_status not null default 'open',
  resolution_note text,
  resolved_by_admin_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index idx_disputes_order on disputes(order_id);
create index idx_disputes_status on disputes(status);
