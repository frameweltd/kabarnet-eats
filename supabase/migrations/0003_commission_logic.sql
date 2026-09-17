-- ============================================================================
-- Commission Logic — implemented as DB functions + triggers so it's
-- enforced consistently no matter which client (web, admin, future mobile)
-- writes to the database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Snapshot commission_rate_applied onto the order at creation time.
--    Never trust the client to send this — always pull live from hotels.
-- ----------------------------------------------------------------------------
create or replace function set_order_commission_rate()
returns trigger
language plpgsql
security definer
as $$
begin
  select commission_rate into new.commission_rate_applied
  from hotels
  where hotel_id = new.hotel_id;

  if new.commission_rate_applied is null then
    raise exception 'Hotel % has no commission rate set', new.hotel_id;
  end if;

  return new;
end;
$$;

create trigger trg_set_order_commission_rate
  before insert on orders
  for each row
  execute function set_order_commission_rate();

-- ----------------------------------------------------------------------------
-- 2. When an order transitions to 'delivered', create the commission record.
--    When it transitions to 'cancelled' AFTER a commission record already
--    exists (e.g. post-delivery dispute refund), reverse it instead of
--    deleting — preserves audit trail.
-- ----------------------------------------------------------------------------
create or replace function handle_order_status_change()
returns trigger
language plpgsql
security definer
as $$
declare
  v_commission_amount decimal(10,2);
  v_payout_amount decimal(10,2);
  v_existing_commission_id uuid;
begin
  -- Log every status change
  insert into order_status_logs (order_id, old_status, new_status, changed_by_type, note)
  values (
    new.order_id,
    old.status,
    new.status,
    'system',
    'Automatic log from status transition'
  );

  -- Stamp timestamps based on transition
  if new.status = 'confirmed' and old.status = 'pending' then
    new.confirmed_at := now();
  elsif new.status = 'delivered' and old.status <> 'delivered' then
    new.delivered_at := now();
  elsif new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  end if;

  -- Create commission record on delivery (only once — guarded by unique order_id)
  if new.status = 'delivered' and old.status <> 'delivered' then
    v_commission_amount := round(new.subtotal * (new.commission_rate_applied / 100), 2);
    v_payout_amount := new.subtotal - v_commission_amount;

    insert into commission_records (
      order_id, hotel_id, order_total, commission_rate,
      commission_amount, hotel_payout_amount, status
    ) values (
      new.order_id, new.hotel_id, new.subtotal, new.commission_rate_applied,
      v_commission_amount, v_payout_amount, 'pending'
    )
    on conflict (order_id) do nothing; -- safety net against double-firing
  end if;

  -- Reverse commission if a delivered order is later cancelled (refund flow)
  if new.status = 'cancelled' and old.status = 'delivered' then
    select commission_id into v_existing_commission_id
    from commission_records
    where order_id = new.order_id and status = 'pending';

    if v_existing_commission_id is not null then
      -- Mark original as reversed
      update commission_records
      set status = 'reversed'
      where commission_id = v_existing_commission_id;

      -- Insert a negative offsetting record for clean audit trail
      insert into commission_records (
        order_id, hotel_id, order_total, commission_rate,
        commission_amount, hotel_payout_amount, status, reversed_commission_id
      )
      select
        order_id, hotel_id, -order_total, commission_rate,
        -commission_amount, -hotel_payout_amount, 'reversed', v_existing_commission_id
      from commission_records
      where commission_id = v_existing_commission_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_handle_order_status_change
  before update of status on orders
  for each row
  when (old.status is distinct from new.status)
  execute function handle_order_status_change();

-- ----------------------------------------------------------------------------
-- 3. Commission rate changes are logged automatically (audit trail).
-- ----------------------------------------------------------------------------
create or replace function log_commission_rate_change()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.commission_rate is distinct from new.commission_rate then
    insert into hotel_commission_history (hotel_id, old_rate, new_rate, changed_by_admin_id)
    values (new.hotel_id, old.commission_rate, new.commission_rate, auth.uid());

    new.commission_rate_effective_from := now();
  end if;
  return new;
end;
$$;

create trigger trg_log_commission_rate_change
  before update of commission_rate on hotels
  for each row
  execute function log_commission_rate_change();

-- ----------------------------------------------------------------------------
-- 4. Helper function: generate a settlement batch for a hotel + period.
--    Called by a scheduled job (e.g. weekly cron via Supabase Edge Function
--    or pg_cron) or manually by admin.
-- ----------------------------------------------------------------------------
create or replace function generate_settlement_batch(
  p_hotel_id uuid,
  p_period_start date,
  p_period_end date
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_batch_id uuid;
  v_total_orders int;
  v_gross_sales decimal(10,2);
  v_total_commission decimal(10,2);
  v_net_payout decimal(10,2);
begin
  select
    count(*),
    coalesce(sum(order_total), 0),
    coalesce(sum(commission_amount), 0),
    coalesce(sum(hotel_payout_amount), 0)
  into v_total_orders, v_gross_sales, v_total_commission, v_net_payout
  from commission_records
  where hotel_id = p_hotel_id
    and status = 'pending'
    and created_at::date between p_period_start and p_period_end;

  insert into settlement_batches (
    hotel_id, period_start, period_end, total_orders,
    gross_sales, total_commission, net_payout
  ) values (
    p_hotel_id, p_period_start, p_period_end, v_total_orders,
    v_gross_sales, v_total_commission, v_net_payout
  )
  returning batch_id into v_batch_id;

  update commission_records
  set status = 'settled', settlement_batch_id = v_batch_id, settled_at = now()
  where hotel_id = p_hotel_id
    and status = 'pending'
    and created_at::date between p_period_start and p_period_end;

  return v_batch_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Weekly payout report view (live, unsettled totals per hotel)
-- ----------------------------------------------------------------------------
create or replace view hotel_pending_payouts as
select
  h.hotel_id,
  h.name as hotel_name,
  count(cr.order_id) as pending_orders,
  coalesce(sum(cr.order_total), 0) as gross_sales,
  coalesce(sum(cr.commission_amount), 0) as total_commission,
  coalesce(sum(cr.hotel_payout_amount), 0) as net_payout_owed
from hotels h
left join commission_records cr
  on cr.hotel_id = h.hotel_id and cr.status = 'pending'
group by h.hotel_id, h.name;
