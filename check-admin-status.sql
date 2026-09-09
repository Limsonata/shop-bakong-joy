-- Check admin status and RLS policies
-- Run this in Supabase SQL Editor

-- 1. Check if you're logged in as admin
SELECT 
  'Current User' as check_type,
  auth.uid() as user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as email,
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as role;

-- 2. Check if is_admin() function works
SELECT 
  'is_admin() check' as check_type,
  public.is_admin() as is_admin;

-- 3. Check RLS policies on products table
SELECT 
  'RLS Policies' as check_type,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('products', 'collections', 'product_images')
ORDER BY tablename, policyname;

-- 4. Check table permissions
SELECT 
  'Table Grants' as check_type,
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name IN ('products', 'collections', 'product_images')
  AND table_schema = 'public'
ORDER BY table_name, grantee;

-- 5. Check if RLS is enabled
SELECT 
  'RLS Enabled' as check_type,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('products', 'collections', 'product_images')
  AND schemaname = 'public';
