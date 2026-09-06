-- Seeds site_content with the values currently hardcoded in the homepage,
-- so installing this feature changes nothing visually until the shop owner
-- edits something in /admin/content.
-- Safe to re-run: upserts by section name.

begin;

insert into public.site_content (section, content) values
(
  'hero',
  '{
    "badge": "Made for her",
    "headingLine1": "Move.",
    "headingLine2": "Look good doing it.",
    "subtext": "Leggings, sports bras and everyday sets built for women, by women. New drops every week, delivered across Cambodia.",
    "primaryButtonLabel": "Shop Now",
    "primaryButtonLink": "/shop",
    "secondaryButtonLabel": "New Arrivals",
    "secondaryButtonSearch": "New Arrivals",
    "backgroundImage": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=1600&q=80"
  }'::jsonb
),
(
  'marquee',
  '{
    "words": ["NEW ARRIVALS", "FREE SHIPPING", "MADE FOR HER", "SHOP THE EDIT", "CASH ON DELIVERY"]
  }'::jsonb
),
(
  'trust_strip',
  '{
    "items": [
      { "title": "Free Shipping", "desc": "Nationwide in Cambodia" },
      { "title": "Cash on Delivery", "desc": "Pay safely on arrival" },
      { "title": "Easy Returns", "desc": "14-day exchange window" }
    ]
  }'::jsonb
),
(
  'cta',
  '{
    "heading": "Your new favorite fit is one tap away",
    "subtext": "Join women across Cambodia shopping BillieGrace Closet for fit, comfort, and easy cash-on-delivery ordering.",
    "buttonLabel": "Shop Now",
    "buttonLink": "/shop"
  }'::jsonb
)
on conflict (section) do nothing;

commit;
