-- Run this in Supabase SQL Editor.
-- Deletes the 6 unrelated legacy products that predate the POS system
-- (Minoxidil, DERCOS shampoos, oils, vitamin) — confirmed by the shop owner
-- as not part of BillieGrace Closet's real inventory.
-- This is irreversible. None of these have a linked stock_items row.
delete from public.products
where handle in (
  'minoxidil-usa',
  'dercos-energising-shampoo',
  'dercos-anti-dandruff-ds-normal-to-oily-hair',
  'rosemary-oil',
  'caster-oil',
  'pumpkin-seed-oil'
);
