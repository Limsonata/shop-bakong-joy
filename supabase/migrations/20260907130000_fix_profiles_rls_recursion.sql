-- ─────────────────────────────────────────────────────────────
-- FIX: profiles RLS infinite recursion (Postgres 42P17)
-- ─────────────────────────────────────────────────────────────
-- Symptom: every admin WRITE fails with "Admin access required"
-- even for a real admin, while the orders LIST still loads.
--
-- Cause: the profiles SELECT policy called public.is_admin(),
-- which queries public.profiles -> the policy ran again -> infinite
-- recursion. assertAdmin() then masked the 42P17 error as a generic
-- "Admin access required".
--
-- Fix: the profiles SELECT policy no longer references is_admin().
-- Users may read only their own profile row (id = auth.uid()).
-- Admin checks on other tables (orders, products, ...) still use
-- public.is_admin(), which is unaffected here.

begin;

-- Keep is_admin() a SECURITY DEFINER so calls from other tables'
-- policies do not re-enter RLS on profiles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists profiles_owner_or_admin_read on public.profiles;
drop policy if exists profiles_owner_update_name on public.profiles;

-- Users may read their own profile. This is the recursion-free form.
create policy profiles_owner_or_admin_read
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Owner may update their own name.
create policy profiles_owner_update_name
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

commit;