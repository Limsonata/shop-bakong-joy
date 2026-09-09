-- CLEAR ALL DATA FROM SHOP
-- This will remove products, orders, sales, stock, cash book, everything
-- User accounts will be preserved

BEGIN;

-- Disable foreign key checks temporarily
SET CONSTRAINTS ALL DEFERRED;

-- 1. Delete all order-related data
DELETE FROM public.order_items;
DELETE FROM public.notifications;
DELETE FROM public.orders;

-- 2. Delete all POS data
DELETE FROM public.stock_movements;
DELETE FROM public.cash_book;
DELETE FROM public.sales;

-- 3. Delete all stock items
DELETE FROM public.stock_items;

-- 4. Delete all products and related data
DELETE FROM public.product_images;
DELETE FROM public.product_tags;
DELETE FROM public.inventory_log;
DELETE FROM public.flash_sales;
DELETE FROM public.products;

-- 5. Delete all collections
DELETE FROM public.product_tags;
DELETE FROM public.tags;
DELETE FROM public.collections;

-- 6. Delete all other shop data
DELETE FROM public.wishlists;
DELETE FROM public.cart_items;
DELETE FROM public.carts;
DELETE FROM public.addresses;
DELETE FROM public.coupons;
DELETE FROM public.banners;
DELETE FROM public.loyalty_points;
DELETE FROM public.referrals;
DELETE FROM public.shipping_rates;
DELETE FROM public.audit_log;
DELETE FROM public.faqs;
DELETE FROM public.feedback;
DELETE FROM public.site_content;

-- Re-enable constraints
SET CONSTRAINTS ALL IMMEDIATE;

COMMIT;

-- Verify cleanup
SELECT 
  'products' as table_name, COUNT(*) as count FROM public.products
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL SELECT 'sales', COUNT(*) FROM public.sales
UNION ALL SELECT 'stock_items', COUNT(*) FROM public.stock_items
UNION ALL SELECT 'collections', COUNT(*) FROM public.collections
UNION ALL SELECT 'cash_book', COUNT(*) FROM public.cash_book
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications;

SELECT '✓✓✓ ALL DATA CLEARED ✓✓✓' as status;
