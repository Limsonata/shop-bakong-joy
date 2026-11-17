-- ─────────────────────────────────────────────────────────────
-- REAL KHQR PAYMENTS (ABA PayWay) + NOTIFICATIONS
-- ─────────────────────────────────────────────────────────────
-- Run in Supabase → SQL Editor (safe to run more than once).
--
--  1. orders: payment_method, paid_at, payment_expires_at; every order
--     gets its own unique reference (old orders shared "ABA-QR" / "COD").
--  2. payments: one row per PayWay QR (tran_id), with the approval code,
--     payer bank and payer account once ABA confirms the money arrived.
--  3. notifications: new types (new_order, payment_received, low_stock …).
--  4. Low / out-of-stock alerts from any sale (POS or online), via trigger.
--  5. New customer feedback alert, via trigger.
--  6. Default low-stock level 3 (was 0, so alerts only fired at sold out).
--  7. Realtime for notifications + orders (live admin bell / order lists).

begin;

-- ── 1. ORDERS ────────────────────────────────────────────────
alter table public.orders
  add column if not exists payment_method text not null default 'cod',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_expires_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('khqr', 'aba_manual', 'cod'));

-- Old orders: the payment method was stored in the reference field.
update public.orders
   set payment_method = 'aba_manual'
 where bakong_reference = 'ABA-QR'
   and payment_method = 'cod';

-- Give every order a unique, human-friendly reference.
update public.orders o
   set bakong_reference = 'BG-' || upper(substr(replace(o.id::text, '-', ''), 1, 10))
 where o.bakong_reference is null
    or o.bakong_reference in ('ABA-QR', 'COD', '')
    or o.bakong_reference in (
         select bakong_reference from public.orders
          where bakong_reference is not null
          group by bakong_reference having count(*) > 1
       );

create unique index if not exists orders_reference_unique
  on public.orders (bakong_reference)
  where bakong_reference is not null;

create index if not exists orders_status_created_idx
  on public.orders (status, created_at desc);

comment on column public.orders.payment_method is
  'khqr = ABA PayWay KHQR (confirmed automatically), aba_manual = static ABA QR (admin confirms), cod = cash on delivery.';
comment on column public.orders.bakong_transaction_id is
  'Current ABA PayWay tran_id for khqr orders (see public.payments for every attempt).';

-- ── 2. PAYMENTS ──────────────────────────────────────────────
create table if not exists public.payments (
  id             uuid        primary key default gen_random_uuid(),
  order_id       uuid        not null references public.orders(id) on delete cascade,
  provider       text        not null default 'payway',
  tran_id        text        not null unique,
  amount         numeric     not null check (amount >= 0),
  currency       text        not null default 'USD',
  status         text        not null default 'pending'
                   check (status in ('pending', 'approved', 'declined', 'expired', 'cancelled', 'refunded')),
  apv            text,
  bank_name      text,
  payer_account  text,
  payment_type   text,
  paid_amount    numeric,
  paid_currency  text,
  qr_string      text,
  deeplink       text,
  expires_at     timestamptz,
  paid_at        timestamptz,
  raw            jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists payments_order_idx on public.payments (order_id, created_at desc);

alter table public.payments enable row level security;
revoke all on table public.payments from anon, authenticated;
grant select on table public.payments to authenticated;

drop policy if exists payments_admin_read on public.payments;
create policy payments_admin_read
  on public.payments for select
  to authenticated
  using (public.is_admin());

comment on table public.payments is
  'ABA PayWay KHQR payment attempts. Written only by the server (service role) after verifying with ABA.';

-- ── 3. NOTIFICATION TYPES ────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'order_update', 'admin_alert', 'promotion', 'system',
    'new_order', 'payment_received', 'payment_issue',
    'low_stock', 'out_of_stock', 'order_cancelled', 'feedback'
  ));

create index if not exists notifications_role_created_idx
  on public.notifications (recipient_role, created_at desc)
  where user_id is null;

-- ── 4. LOW / OUT OF STOCK ALERTS ─────────────────────────────
-- Fires only when stock CROSSES the line, so each item alerts once per drop.
create or replace function public.stock_items_low_stock_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_left integer := coalesce(old.stock_in, 0) - coalesce(old.sold, 0);
  new_left integer := coalesce(new.stock_in, 0) - coalesce(new.sold, 0);
  variant  text;
  label    text;
begin
  if new.archived then
    return new;
  end if;

  variant := concat_ws(' ', nullif(nullif(new.size, ''), 'Default'), nullif(new.color, ''));
  label := new.name || case when coalesce(variant, '') <> '' then ' (' || variant || ')' else '' end;

  if new_left <= 0 and old_left > 0 then
    insert into public.notifications (recipient_role, type, title, message, data)
    values ('admin', 'out_of_stock', 'Sold out: ' || label,
            label || ' is sold out. Restock it or hide it from the shop.',
            jsonb_build_object('stockItemId', new.id, 'left', new_left, 'link', '/admin/inventory'));
  elsif new_left <= new.low_stock_at and old_left > new.low_stock_at and new_left > 0 then
    insert into public.notifications (recipient_role, type, title, message, data)
    values ('admin', 'low_stock', 'Low stock: ' || label,
            'Only ' || new_left || ' left of ' || label || '.',
            jsonb_build_object('stockItemId', new.id, 'left', new_left, 'link', '/admin/inventory'));
  end if;

  return new;
end;
$$;

revoke execute on function public.stock_items_low_stock_notify() from public, anon, authenticated;

drop trigger if exists stock_items_low_stock on public.stock_items;
create trigger stock_items_low_stock
  after update of stock_in, sold on public.stock_items
  for each row execute function public.stock_items_low_stock_notify();

-- ── 5. NEW FEEDBACK ALERT ────────────────────────────────────
create or replace function public.feedback_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_role, type, title, message, data)
  values ('admin', 'feedback',
          'New review from ' || coalesce(nullif(new.name, ''), 'a customer') || ' (' || new.rating || '★)',
          left(coalesce(new.text, ''), 200),
          jsonb_build_object('feedbackId', new.id, 'link', '/admin/feedback'));
  return new;
end;
$$;

revoke execute on function public.feedback_notify() from public, anon, authenticated;

drop trigger if exists feedback_notify on public.feedback;
create trigger feedback_notify
  after insert on public.feedback
  for each row execute function public.feedback_notify();

-- ── 6. DEFAULT LOW-STOCK LEVEL ───────────────────────────────
alter table public.stock_items alter column low_stock_at set default 3;
update public.stock_items set low_stock_at = 3 where low_stock_at = 0 and archived = false;

-- ── 7. REALTIME ──────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
      alter publication supabase_realtime add table public.notifications;
    end if;
    if not exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
