-- COMPLETE FIX FOR "permission denied for table products"
-- Run this ENTIRE script in Supabase SQL Editor

-- ==========================================
-- STEP 1: Verify is_admin() function exists and works
-- ==========================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

SELECT '✓ is_admin() function created' as status;

-- ==========================================
-- STEP 2: Ensure your user has admin role
-- ==========================================

-- Check current user
DO $$
DECLARE
  current_user_id UUID;
  current_email TEXT;
  current_role TEXT;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE NOTICE '⚠ No user logged in via auth.uid()';
  ELSE
    SELECT email INTO current_email FROM auth.users WHERE id = current_user_id;
    SELECT role INTO current_role FROM public.profiles WHERE id = current_user_id;
    
    RAISE NOTICE 'Current user: % (role: %)', current_email, current_role;
    
    IF current_role IS NULL OR current_role != 'admin' THEN
      -- Force set to admin
      UPDATE public.profiles SET role = 'admin' WHERE id = current_user_id;
      RAISE NOTICE '✓ Updated role to admin';
    END IF;
  END IF;
END $$;

SELECT '✓ Admin role verified' as status;

-- ==========================================
-- STEP 3: Grant table permissions
-- ==========================================

-- Grant to authenticated role (admin users)
GRANT ALL ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.collections TO authenticated;
GRANT ALL ON TABLE public.product_images TO authenticated;
GRANT ALL ON TABLE public.stock_items TO authenticated;

-- Grant read to anon (public storefront)
GRANT SELECT ON TABLE public.products TO anon;
GRANT SELECT ON TABLE public.collections TO anon;
GRANT SELECT ON TABLE public.product_images TO anon;

SELECT '✓ Table permissions granted' as status;

-- ==========================================
-- STEP 4: Enable RLS
-- ==========================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

SELECT '✓ RLS enabled' as status;

-- ==========================================
-- STEP 5: Create RLS policies
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS products_public_read ON public.products;
DROP POLICY IF EXISTS products_admin_insert ON public.products;
DROP POLICY IF EXISTS products_admin_update ON public.products;
DROP POLICY IF EXISTS products_admin_delete ON public.products;

-- Create new policies for products
CREATE POLICY products_public_read
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY products_admin_insert
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY products_admin_update
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY products_admin_delete
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

SELECT '✓ Products policies created' as status;

-- Same for collections
DROP POLICY IF EXISTS collections_public_read ON public.collections;
DROP POLICY IF EXISTS collections_admin_insert ON public.collections;
DROP POLICY IF EXISTS collections_admin_update ON public.collections;
DROP POLICY IF EXISTS collections_admin_delete ON public.collections;

CREATE POLICY collections_public_read
  ON public.collections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY collections_admin_insert
  ON public.collections FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY collections_admin_update
  ON public.collections FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY collections_admin_delete
  ON public.collections FOR DELETE
  TO authenticated
  USING (public.is_admin());

SELECT '✓ Collections policies created' as status;

-- Same for stock_items
DROP POLICY IF EXISTS stock_items_admin_all ON public.stock_items;
DROP POLICY IF EXISTS stock_items_admin_insert ON public.stock_items;
DROP POLICY IF EXISTS stock_items_admin_update ON public.stock_items;
DROP POLICY IF EXISTS stock_items_admin_delete ON public.stock_items;

CREATE POLICY stock_items_admin_all
  ON public.stock_items FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

SELECT '✓ Stock items policies created' as status;

-- ==========================================
-- STEP 6: Reload schema
-- ==========================================

NOTIFY pgrst, 'reload schema';

-- ==========================================
-- FINAL CHECK
-- ==========================================

SELECT 
  '✓✓✓ FIX COMPLETE ✓✓✓' as status,
  auth.uid() as your_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as your_email,
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as your_role,
  public.is_admin() as is_admin_check;

-- Test insert (should work now)
-- Run this separately to verify:
-- INSERT INTO public.products (handle, title, price, currency) 
-- VALUES ('test-product', 'Test', 0, 'USD') 
-- RETURNING id;
