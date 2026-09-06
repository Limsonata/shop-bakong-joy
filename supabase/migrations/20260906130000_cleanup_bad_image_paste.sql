-- Run this in Supabase SQL Editor.
-- Clears the accidental base64 image data that got pasted into image_url
-- on the unrelated pre-existing products (Minoxidil, DERCOS, oils, etc).
-- This does not delete any product, only clears one column back to null.
update public.products
set image_url = null
where handle in (
  'minoxidil-usa',
  'dercos-energising-shampoo',
  'dercos-anti-dandruff-ds-normal-to-oily-hair',
  'rosemary-oil',
  'caster-oil',
  'pumpkin-seed-oil'
);
