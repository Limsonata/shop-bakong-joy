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

-- Drop EVERY policy on profiles, whatever it is called. This guarantees the
-- recursive doc-style policies (e.g. "Admins can view all profiles") are gone
-- even if the database was set up with different or unexpected policy names.
do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', r.policyname);
  end loop;
end $$;

-- Users may read their own profile. This is the recursion-free form.
create policy profiles_owner_or_admin_read
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Owner may update their own name. The `role = 'user'` guard in the WITH CHECK
-- is essential: without it a user could PATCH their own row with
-- {"role": "admin"} and escalate to admin (RLS privilege-escalation hole).
-- Admins can still edit any profile via profiles_admin_update below.
create policy profiles_owner_update_name
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and role = 'user');

-- Admins may update any profile (permissive OR with the owner policy above).
create policy profiles_admin_update
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;