-- CLEAR ALL DATA FROM SHOP (Safe version - only existing tables)
-- This will remove products, orders, sales, stock, everything

BEGIN;

-- 1. Delete notifications (if exists)
DELETE FROM public.notifications WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications');

-- 2. Delete orders (if exists)
DELETE FROM public.orders WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders');

-- 3. Delete stock movements (if exists)
DELETE FROM public.stock_movements WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_movements');

-- 4. Delete sales (if exists)
DELETE FROM public.sales WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales');

-- 5. Delete stock items (if exists)
DELETE FROM public.stock_items WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_items');

-- 6. Delete product images (if exists)
DELETE FROM public.product_images WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_images');

-- 7. Delete inventory log (if exists)
DELETE FROM public.inventory_log WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_log');

-- 8. Delete flash sales (if exists)
DELETE FROM public.flash_sales WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'flash_sales');

-- 9. Delete products
DELETE FROM public.products;

-- 10. Delete product tags (if exists)
DELETE FROM public.product_tags WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_tags');

-- 11. Delete tags (if exists)
DELETE FROM public.tags WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags');

-- 12. Delete collections
DELETE FROM public.collections;

-- 13. Delete feedback (if exists)
DELETE FROM public.feedback WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback');

-- 14. Delete site content (if exists)
DELETE FROM public.site_content WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_content');

COMMIT;

-- Verify cleanup
SELECT 'products' as table_name, COUNT(*) as count FROM public.products
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders
UNION ALL SELECT 'sales', COUNT(*) FROM public.sales
UNION ALL SELECT 'stock_items', COUNT(*) FROM public.stock_items
UNION ALL SELECT 'collections', COUNT(*) FROM public.collections;

SELECT '✓✓✓ ALL DATA CLEARED ✓✓✓' as status;
