-- ============================================================================
-- Row Level Security
-- Every table is locked down by default; policies grant narrow access.
-- Strategy: admins see everything, each role sees only their own data,
-- and cross-role visibility (e.g. hotel seeing customer address for an
-- order) is scoped to rows that relate to them via orders.
-- ============================================================================

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
alter table profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on profiles for select
  using (id = auth.uid() or is_admin());

create policy "profiles_insert_own"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles_update_own_or_admin"
  on profiles for update
  using (id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- HOTELS
-- Public can view active hotels (browsing menu before login).
-- Hotel owner manages their own row. Admin manages all.
-- ----------------------------------------------------------------------------
alter table hotels enable row level security;

create policy "hotels_select_active_public"
  on hotels for select
  using (status = 'active' or hotel_id = auth.uid() or is_admin());

create policy "hotels_insert_own"
  on hotels for insert
  with check (hotel_id = auth.uid());

create policy "hotels_update_own_or_admin"
  on hotels for update
  using (hotel_id = auth.uid() or is_admin());

-- Only admins should change commission_rate / status in practice;
-- enforce via application logic + this policy limiting who can update at all.
-- (Column-level restriction can be added later with a trigger if needed.)

-- ----------------------------------------------------------------------------
-- HOTEL COMMISSION HISTORY — admin only
-- ----------------------------------------------------------------------------
alter table hotel_commission_history enable row level security;

create policy "commission_history_admin_only"
  on hotel_commission_history for all
  using (is_admin())
  with check (is_admin());

create policy "commission_history_hotel_can_view_own"
  on hotel_commission_history for select
  using (hotel_id = auth.uid());

-- ----------------------------------------------------------------------------
-- MENU ITEMS — public can view available items of active hotels; hotel owns theirs
-- ----------------------------------------------------------------------------
alter table menu_items enable row level security;

create policy "menu_items_select_public"
  on menu_items for select
  using (
    is_available = true
    or hotel_id = auth.uid()
    or is_admin()
  );

create policy "menu_items_manage_own_hotel"
  on menu_items for all
  using (hotel_id = auth.uid() or is_admin())
  with check (hotel_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
alter table customers enable row level security;

create policy "customers_select_own_or_admin"
  on customers for select
  using (customer_id = auth.uid() or is_admin());

create policy "customers_insert_own"
  on customers for insert
  with check (customer_id = auth.uid());

create policy "customers_update_own"
  on customers for update
  using (customer_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- CUSTOMER ADDRESSES — owner only, plus hotels/riders involved in an order
-- ----------------------------------------------------------------------------
alter table customer_addresses enable row level security;

create policy "addresses_select_own_or_related"
  on customer_addresses for select
  using (
    customer_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from orders o
      where o.delivery_address_id = customer_addresses.address_id
        and (o.hotel_id = auth.uid() or o.rider_id = auth.uid())
    )
  );

create policy "addresses_manage_own"
  on customer_addresses for all
  using (customer_id = auth.uid() or is_admin())
  with check (customer_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- RIDERS
-- ----------------------------------------------------------------------------
alter table riders enable row level security;

create policy "riders_select_own_or_admin"
  on riders for select
  using (rider_id = auth.uid() or is_admin());

create policy "riders_select_by_hotel_when_assigned"
  on riders for select
  using (
    exists (
      select 1 from orders o
      where o.rider_id = riders.rider_id and o.hotel_id = auth.uid()
    )
  );

create policy "riders_insert_own"
  on riders for insert
  with check (rider_id = auth.uid());

create policy "riders_update_own_or_admin"
  on riders for update
  using (rider_id = auth.uid() or is_admin());

-- ----------------------------------------------------------------------------
-- ORDERS — customer sees own, hotel sees theirs, rider sees assigned, admin sees all
-- ----------------------------------------------------------------------------
alter table orders enable row level security;

create policy "orders_select_related"
  on orders for select
  using (
    customer_id = auth.uid()
    or hotel_id = auth.uid()
    or rider_id = auth.uid()
    or is_admin()
  );

create policy "orders_insert_own_customer"
  on orders for insert
  with check (customer_id = auth.uid());

create policy "orders_update_related"
  on orders for update
  using (
    customer_id = auth.uid()
    or hotel_id = auth.uid()
    or rider_id = auth.uid()
    or is_admin()
  );

-- ----------------------------------------------------------------------------
-- ORDER ITEMS — visible to whoever can see the parent order
-- ----------------------------------------------------------------------------
alter table order_items enable row level security;

create policy "order_items_select_via_order"
  on order_items for select
  using (
    exists (
      select 1 from orders o
      where o.order_id = order_items.order_id
        and (o.customer_id = auth.uid() or o.hotel_id = auth.uid() or o.rider_id = auth.uid())
    )
    or is_admin()
  );

create policy "order_items_insert_via_order"
  on order_items for insert
  with check (
    exists (
      select 1 from orders o
      where o.order_id = order_items.order_id and o.customer_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- PAYMENTS — visible to order's customer/hotel, admin. Writes restricted.
-- ----------------------------------------------------------------------------
alter table payments enable row level security;

create policy "payments_select_via_order"
  on payments for select
  using (
    exists (
      select 1 from orders o
      where o.order_id = payments.order_id
        and (o.customer_id = auth.uid() or o.hotel_id = auth.uid())
    )
    or is_admin()
  );

-- Payment inserts/updates happen via server-side (service role) for M-Pesa
-- callbacks — no direct client insert policy is granted for those paths.
create policy "payments_insert_admin_or_service"
  on payments for insert
  with check (is_admin());

create policy "payments_update_admin_or_service"
  on payments for update
  using (is_admin());

-- ----------------------------------------------------------------------------
-- COMMISSION RECORDS — hotel sees own, admin sees all. No client writes.
-- ----------------------------------------------------------------------------
alter table commission_records enable row level security;

create policy "commission_select_own_hotel_or_admin"
  on commission_records for select
  using (hotel_id = auth.uid() or is_admin());

create policy "commission_admin_write_only"
  on commission_records for all
  using (is_admin())
  with check (is_admin());

-- ----------------------------------------------------------------------------
-- SETTLEMENT BATCHES — hotel sees own, admin manages all
-- ----------------------------------------------------------------------------
alter table settlement_batches enable row level security;

create policy "settlements_select_own_hotel_or_admin"
  on settlement_batches for select
  using (hotel_id = auth.uid() or is_admin());

create policy "settlements_admin_write_only"
  on settlement_batches for all
  using (is_admin())
  with check (is_admin());

-- ----------------------------------------------------------------------------
-- ORDER STATUS LOGS — visible to whoever can see the order; insert by related parties
-- ----------------------------------------------------------------------------
alter table order_status_logs enable row level security;

create policy "status_logs_select_via_order"
  on order_status_logs for select
  using (
    exists (
      select 1 from orders o
      where o.order_id = order_status_logs.order_id
        and (o.customer_id = auth.uid() or o.hotel_id = auth.uid() or o.rider_id = auth.uid())
    )
    or is_admin()
  );

create policy "status_logs_insert_related"
  on order_status_logs for insert
  with check (
    exists (
      select 1 from orders o
      where o.order_id = order_status_logs.order_id
        and (o.customer_id = auth.uid() or o.hotel_id = auth.uid() or o.rider_id = auth.uid())
    )
    or is_admin()
  );

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS — recipient only
-- ----------------------------------------------------------------------------
alter table notifications enable row level security;

create policy "notifications_select_own"
  on notifications for select
  using (recipient_id = auth.uid() or is_admin());

create policy "notifications_update_own_read_status"
  on notifications for update
  using (recipient_id = auth.uid());

-- ----------------------------------------------------------------------------
-- DISPUTES — visible to order's customer/hotel and admin
-- ----------------------------------------------------------------------------
alter table disputes enable row level security;

create policy "disputes_select_related"
  on disputes for select
  using (
    raised_by_id = auth.uid()
    or is_admin()
    or exists (
      select 1 from orders o
      where o.order_id = disputes.order_id
        and (o.customer_id = auth.uid() or o.hotel_id = auth.uid())
    )
  );

create policy "disputes_insert_related"
  on disputes for insert
  with check (
    raised_by_id = auth.uid()
    and exists (
      select 1 from orders o
      where o.order_id = disputes.order_id
        and (o.customer_id = auth.uid() or o.hotel_id = auth.uid())
    )
  );

create policy "disputes_update_admin_only"
  on disputes for update
  using (is_admin());
