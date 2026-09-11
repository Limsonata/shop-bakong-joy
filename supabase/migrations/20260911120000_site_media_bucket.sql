-- Public "site-media" storage bucket: holds images and videos inserted from
-- the admin Content page (hero dual-tile photos, Runway & Beyond popup film,
-- poster frames, ...).
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do nothing;

-- Anyone can view the uploaded media — it is public store content.
create policy "Public read site media"
on storage.objects for select
using (bucket_id = 'site-media');

-- Signed-in staff (admins use Supabase Auth) can upload / replace media.
create policy "Authenticated upload site media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'site-media');

create policy "Authenticated update site media"
on storage.objects for update
to authenticated
using (bucket_id = 'site-media');

create policy "Authenticated delete site media"
on storage.objects for delete
to authenticated
using (bucket_id = 'site-media');
