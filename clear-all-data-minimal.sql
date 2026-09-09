-- CLEAR ALL DATA (Minimal version - only core tables)

BEGIN;

-- Delete from core tables that definitely exist
DELETE FROM public.notifications;
DELETE FROM public.orders;
DELETE FROM public.stock_movements;
DELETE FROM public.sales;
DELETE FROM public.stock_items;
DELETE FROM public.product_images;
DELETE FROM public.products;
DELETE FROM public.collections;
DELETE FROM public.feedback;

COMMIT;

-- Verify
SELECT 'products' as table_name, COUNT(*) as count FROM public.products
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL SELECT 'sales', COUNT(*) FROM public.sales
UNION ALL SELECT 'stock_items', COUNT(*) FROM public.stock_items
UNION ALL SELECT 'collections', COUNT(*) FROM public.collections;

SELECT '✓✓✓ ALL DATA CLEARED ✓✓✓' as status;
