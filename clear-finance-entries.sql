-- CLEAR REMAINING MONEY DATA
-- The cash book is stored in "finance_entries", not "cash_book"

BEGIN;

DELETE FROM public.finance_entries;
DELETE FROM public.stock_movements;
DELETE FROM public.sales;
DELETE FROM public.stock_items;

COMMIT;

-- Verify everything is now zero
SELECT 'finance_entries' as table_name, COUNT(*) as count FROM public.finance_entries
UNION ALL SELECT 'sales', COUNT(*) FROM public.sales
UNION ALL SELECT 'stock_items', COUNT(*) FROM public.stock_items
UNION ALL SELECT 'stock_movements', COUNT(*) FROM public.stock_movements
UNION ALL SELECT 'products', COUNT(*) FROM public.products
UNION ALL SELECT 'orders', COUNT(*) FROM public.orders;

SELECT '✓ Finance entries and remaining POS data cleared' as status;
