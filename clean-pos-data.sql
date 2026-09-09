-- Clean all POS system data (safe cleanup)
-- This will remove sales, stock, and cash book records
-- Products (storefront catalog) will be preserved

BEGIN;

-- 1. Delete all stock movements (audit trail for stock changes)
DELETE FROM public.stock_movements;

-- 2. Delete all cash book entries (money in/out records)
DELETE FROM public.cash_book;

-- 3. Delete all sales records (in-store and online sales)
DELETE FROM public.sales;

-- 4. Archive all stock items (preserves product links)
UPDATE public.stock_items 
SET archived = true, 
    stock_in = 0,
    updated_at = NOW()
WHERE archived = false;

-- 5. Reset online orders to pending (optional - comment out if you want to keep orders)
-- UPDATE public.orders SET status = 'pending' WHERE status != 'pending';

-- 6. Clear any POS-related notifications
DELETE FROM public.notifications 
WHERE type IN ('sale_created', 'low_stock', 'order_created');

COMMIT;

-- Verify the cleanup
SELECT 
  'Stock Movements' as table_name, 
  COUNT(*) as count 
FROM public.stock_movements
UNION ALL
SELECT 
  'Cash Book', 
  COUNT(*) 
FROM public.cash_book
UNION ALL
SELECT 
  'Sales', 
  COUNT(*) 
FROM public.sales
UNION ALL
SELECT 
  'Active Stock Items', 
  COUNT(*) 
FROM public.stock_items 
WHERE archived = false;
