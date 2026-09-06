-- ─────────────────────────────────────────────────────────────
-- SITE CONTENT  (editable homepage sections, admin-managed)
-- ─────────────────────────────────────────────────────────────
-- One row per section (hero, trust_strip, cta, ...). `content` is jsonb so
-- each section can hold whatever fields it needs without new migrations.
-- Public (customers) can read; only admins can write.

begin;

create table if not exists public.site_content (
  id         uuid        primary key default gen_random_uuid(),
  section    text        unique not null,
  content    jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id) on delete set null
);

comment on table public.site_content is 'Editable homepage/site copy and images, keyed by section name.';

create or replace function public.site_content_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists site_content_updated_at on public.site_content;
create trigger site_content_updated_at
  before update on public.site_content
  for each row execute function public.site_content_set_updated_at();

alter table public.site_content enable row level security;

grant select on table public.site_content to anon, authenticated;
grant insert, update, delete on table public.site_content to authenticated;

drop policy if exists site_content_public_read on public.site_content;
create policy site_content_public_read
  on public.site_content for select
  to anon, authenticated
  using (true);

drop policy if exists site_content_admin_write on public.site_content;
create policy site_content_admin_write
  on public.site_content for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

commit;

notify pgrst, 'reload schema';
