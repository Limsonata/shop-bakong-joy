-- Seed hairora collections and products.
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING.

-- ── Collections ─────────────────────────────────────────────────────────────

insert into public.collections (id, handle, title, description) values
  ('c1111111-0000-0000-0000-000000000001', 'laser-therapy',      'Laser Therapy',       'FDA-cleared low-level laser therapy devices for hair regrowth'),
  ('c1111111-0000-0000-0000-000000000002', 'minoxidil',          'Minoxidil Solutions', 'Clinically proven topical minoxidil for men and women'),
  ('c1111111-0000-0000-0000-000000000003', 'bundles',            'Treatment Bundles',   'Combined laser + topical programmes for maximum results'),
  ('c1111111-0000-0000-0000-000000000004', 'accessories',        'Accessories',         'Caps, combs, and maintenance tools')
on conflict (handle) do nothing;

-- ── Products ─────────────────────────────────────────────────────────────────

insert into public.products
  (handle, title, description, product_type, price, currency, image_url, in_stock, collections, variants)
values

-- LED Laser Hair Growth Cap
(
  'led-laser-hair-growth-cap',
  'hairora LED Laser Hair Growth Cap',
  'Clinically proven 272-diode low-level laser therapy (LLLT) cap. Covers your entire scalp with 650 nm medical-grade laser diodes shown to stimulate dormant hair follicles. FDA-cleared. Wear 30 minutes every other day — most users see visible regrowth in 16 weeks. Rechargeable battery, auto-shutoff timer, and portable carry case included.',
  'Laser Device',
  299.00,
  'USD',
  '/led-cap.png',
  true,
  ARRAY['c1111111-0000-0000-0000-000000000001', 'c1111111-0000-0000-0000-000000000003'],
  '[
    {"id":"led-cap-v1","title":"Standard (272 Diodes)","option":"272 Diodes","price":299.00,"availableForSale":true},
    {"id":"led-cap-v2","title":"Pro (272 Diodes + Carrying Case)","option":"Pro Bundle","price":329.00,"availableForSale":true}
  ]'::jsonb
),

-- Morr F5 Minoxidil Solution
(
  'morr-f5-minoxidil-solution',
  'Morr F5% Minoxidil Solution',
  'Morr F5 is a 5% minoxidil topical solution for men experiencing androgenetic alopecia (male-pattern baldness). Clinically studied active ingredient applied directly to the scalp twice daily. Each 60 ml bottle provides a full month of treatment. Best combined with the hairora LED cap for enhanced results.',
  'Minoxidil',
  35.00,
  'USD',
  '/morr-f5.webp',
  true,
  ARRAY['c1111111-0000-0000-0000-000000000002', 'c1111111-0000-0000-0000-000000000003'],
  '[
    {"id":"morr-f5-v1","title":"1 Bottle (60 ml / 1 month)","option":"1 Bottle","price":35.00,"availableForSale":true},
    {"id":"morr-f5-v2","title":"3 Bottles (60 ml × 3 / 3 months)","option":"3 Bottles","price":95.00,"availableForSale":true},
    {"id":"morr-f5-v3","title":"6 Bottles (60 ml × 6 / 6 months)","option":"6 Bottles","price":175.00,"availableForSale":true}
  ]'::jsonb
),

-- Complete Hair Restoration Bundle
(
  'complete-hair-restoration-bundle',
  'Complete Hair Restoration Bundle',
  'Everything you need to tackle hair loss from two angles at once. Includes the hairora LED Laser Cap (272 diodes) and a 3-month supply of Morr F5% Minoxidil Solution. Dual-action protocol: laser therapy reactivates dormant follicles while minoxidil extends the hair growth cycle. Save $24 versus buying separately.',
  'Bundle',
  309.00,
  'USD',
  '/led-cap.png',
  true,
  ARRAY['c1111111-0000-0000-0000-000000000003'],
  '[
    {"id":"bundle-v1","title":"LED Cap + 3-Month Minoxidil","option":"Standard Bundle","price":309.00,"availableForSale":true}
  ]'::jsonb
),

-- Morr F Women (2%)
(
  'morr-f2-minoxidil-women',
  'Morr F2% Minoxidil Solution (Women)',
  'Specifically formulated 2% minoxidil solution for women experiencing hair thinning and alopecia. Gentle, dermatologist-recommended concentration for female-pattern hair loss. Apply to the affected scalp area twice daily. 60 ml bottle (1 month supply).',
  'Minoxidil',
  30.00,
  'USD',
  '/morr-f5.webp',
  true,
  ARRAY['c1111111-0000-0000-0000-000000000002'],
  '[
    {"id":"morr-f2-v1","title":"1 Bottle (60 ml / 1 month)","option":"1 Bottle","price":30.00,"availableForSale":true},
    {"id":"morr-f2-v2","title":"3 Bottles (60 ml × 3 / 3 months)","option":"3 Bottles","price":80.00,"availableForSale":true}
  ]'::jsonb
),

-- Derma Roller
(
  'derma-roller-0-5mm',
  'Derma Roller 0.5mm — Scalp Microneedling',
  '0.5 mm titanium microneedle derma roller for scalp use. Microneedling creates micro-channels that increase minoxidil absorption by up to 4× and stimulates collagen production around hair follicles. Use once per week before applying minoxidil. Sterilise before and after each use.',
  'Accessory',
  18.00,
  'USD',
  null,
  true,
  ARRAY['c1111111-0000-0000-0000-000000000004'],
  '[
    {"id":"derma-v1","title":"Single Roller","option":"Single","price":18.00,"availableForSale":true}
  ]'::jsonb
),

-- Scalp Massage Comb
(
  'scalp-massage-comb',
  'Electric Scalp Massage Comb',
  'Vibrating scalp massager with fine silicone teeth. Improves blood circulation to hair follicles, reduces DHT buildup in the scalp, and evenly distributes topical treatments like minoxidil. Battery-operated, waterproof, suitable for use in the shower.',
  'Accessory',
  22.00,
  'USD',
  null,
  true,
  ARRAY['c1111111-0000-0000-0000-000000000004'],
  '[
    {"id":"comb-v1","title":"Electric Scalp Comb","option":"Standard","price":22.00,"availableForSale":true}
  ]'::jsonb
)

on conflict (handle) do nothing;

notify pgrst, 'reload schema';
