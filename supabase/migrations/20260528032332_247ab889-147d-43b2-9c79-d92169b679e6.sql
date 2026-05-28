
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy if exists "product-images public read" on storage.objects;
-- Public bucket: getPublicUrl works without a SELECT policy. No SELECT policy = no listing.
