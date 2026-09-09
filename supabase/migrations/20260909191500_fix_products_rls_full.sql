-- Complete RLS fix for products table and related tables.
-- Run this in Supabase SQL Editor to resolve "permission denied for table products" errors.

-- ============================================
-- 1. GRANT proper table permissions
-- ============================================

-- Grant SELECT to anon and authenticated (public read for storefront)
GRANT SELECT ON TABLE public.products TO anon, authenticated;
GRANT SELECT ON TABLE public.collections TO anon, authenticated;
GRANT SELECT ON TABLE public.product_images TO anon, authenticated;

-- Grant ALL to authenticated for admin operations (RLS policies will enforce admin role)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_images TO authenticated;

-- Revoke write access from anon (anonymous users should never write products)
REVOKE INSERT, UPDATE, DELETE ON TABLE public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.collections FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_images FROM anon;

-- ============================================
-- 2. Ensure RLS is enabled
-- ============================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. Create/update helper function to check admin role
-- ============================================

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

-- Grant execute permission to anon and authenticated
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ============================================
-- 4. Drop existing policies (safe to run multiple times)
-- ============================================

DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
DROP POLICY IF EXISTS "Only admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Only admins can update products" ON public.products;
DROP POLICY IF EXISTS "Only admins can delete products" ON public.products;
DROP POLICY IF EXISTS products_public_read ON public.products;
DROP POLICY IF EXISTS products_admin_insert ON public.products;
DROP POLICY IF EXISTS products_admin_update ON public.products;
DROP POLICY IF EXISTS products_admin_delete ON public.products;

DROP POLICY IF EXISTS collections_public_read ON public.collections;
DROP POLICY IF EXISTS collections_admin_insert ON public.collections;
DROP POLICY IF EXISTS collections_admin_update ON public.collections;
DROP POLICY IF EXISTS collections_admin_delete ON public.collections;

DROP POLICY IF EXISTS product_images_public_read ON public.product_images;
DROP POLICY IF EXISTS product_images_admin_insert ON public.product_images;
DROP POLICY IF EXISTS product_images_admin_update ON public.product_images;
DROP POLICY IF EXISTS product_images_admin_delete ON public.product_images;

-- ============================================
-- 5. Create new RLS policies for products
-- ============================================

-- Public read: everyone can view products (storefront)
CREATE POLICY products_public_read
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin insert: only admins can create products
CREATE POLICY products_admin_insert
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin update: only admins can update products
CREATE POLICY products_admin_update
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin delete: only admins can delete products
CREATE POLICY products_admin_delete
  ON public.products FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================
-- 6. Create new RLS policies for collections
-- ============================================

-- Public read: everyone can view collections
CREATE POLICY collections_public_read
  ON public.collections FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin insert: only admins can create collections
CREATE POLICY collections_admin_insert
  ON public.collections FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin update: only admins can update collections
CREATE POLICY collections_admin_update
  ON public.collections FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin delete: only admins can delete collections
CREATE POLICY collections_admin_delete
  ON public.collections FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================
-- 7. Create new RLS policies for product_images
-- ============================================

-- Public read: everyone can view product images
CREATE POLICY product_images_public_read
  ON public.product_images FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin insert: only admins can add product images
CREATE POLICY product_images_admin_insert
  ON public.product_images FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin update: only admins can update product images
CREATE POLICY product_images_admin_update
  ON public.product_images FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin delete: only admins can delete product images
CREATE POLICY product_images_admin_delete
  ON public.product_images FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================
-- 8. Notify PostgREST to reload schema
-- ============================================

NOTIFY pgrst, 'reload schema';
