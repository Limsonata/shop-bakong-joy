-- Multi-image products.
-- Adds an `images` jsonb column (array of URL strings, first = main image).
-- `image_url` stays in sync with the first image so existing code
-- (order thumbnails, product cards) keeps working unchanged.

alter table public.products add column if not exists images jsonb not null default '[]'::jsonb;



-- Backfill: single-image products keep their photo as the first gallery image.
update public.products
set images = jsonb_build_array(image_url)
where (images is null or images = '[]'::jsonb)
  and image_url is not null
  and image_url <> '';
