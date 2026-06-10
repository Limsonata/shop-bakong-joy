-- Notifications table for order updates, admin alerts, promotions, and system messages.
-- user_id = null + recipient_role = broadcast to that role.

create table public.notifications (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        references auth.users(id) on delete cascade,
  recipient_role   text        check (recipient_role in ('user', 'admin', 'all')),
  type             text        not null
                               check (type in ('order_update', 'admin_alert', 'promotion', 'system')),
  title            text        not null,
  message          text        not null,
  data             jsonb,
  read             boolean     not null default false,
  created_at       timestamptz not null default now(),

  -- either targeted to a specific user OR broadcast to a role, not both
  constraint notifications_target_check
    check (
      (user_id is not null and recipient_role is null)
      or (user_id is null and recipient_role is not null)
    )
);

create index notifications_user_id_idx    on public.notifications (user_id);
create index notifications_created_at_idx on public.notifications (created_at desc);
create index notifications_type_idx       on public.notifications (type);
create index notifications_read_idx       on public.notifications (user_id, read) where user_id is not null;

alter table public.notifications enable row level security;

-- Only admins can INSERT / DELETE; users can only SELECT + mark read (UPDATE)
revoke insert, update, delete on table public.notifications from anon;

-- ── SELECT ────────────────────────────────────────────────────────────────────
-- Users see their own direct notifications + broadcasts targeting their role
create policy notifications_user_read
  on public.notifications for select
  to authenticated
  using (
    (user_id = (select auth.uid()))
    or (
      user_id is null
      and recipient_role in (
        'all',
        (select role from public.profiles where id = (select auth.uid()))
      )
    )
    or public.is_admin()
  );

-- ── INSERT ────────────────────────────────────────────────────────────────────
create policy notifications_admin_insert
  on public.notifications for insert
  to authenticated
  with check (public.is_admin());

-- ── UPDATE (mark as read) ─────────────────────────────────────────────────────
-- Users can only flip `read` to true on notifications they can see
create policy notifications_user_mark_read
  on public.notifications for update
  to authenticated
  using (
    (user_id = (select auth.uid()))
    or (
      user_id is null
      and recipient_role in (
        'all',
        (select role from public.profiles where id = (select auth.uid()))
      )
    )
  )
  with check (
    read = true
  );

-- Admins can update any notification
create policy notifications_admin_update
  on public.notifications for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── DELETE ────────────────────────────────────────────────────────────────────
create policy notifications_admin_delete
  on public.notifications for delete
  to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
