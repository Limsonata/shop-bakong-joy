-- DIAGNOSE: Check all permissions and policies on products table
-- Run this in Supabase SQL Editor

-- 1. Check current user and role
SELECT 
  'Current User' as info,
  auth.uid() as user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as email,
  (SELECT role FROM public.profiles WHERE id = auth.uid()) as profile_role;

-- 2. Check if is_admin() works
SELECT 
  'is_admin() result' as info,
  public.is_admin() as is_admin;

-- 3. Check table permissions (grants)
SELECT 
  'Table Grants' as info,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_name = 'products' 
  AND table_schema = 'public'
ORDER BY grantee;

-- 4. Check RLS policies on products
SELECT 
  'RLS Policies' as info,
  policyname,
  permissive,
  roles,
  cmd as operation,
  qual::text as using_expression,
  with_check::text as with_check_expression
FROM pg_policies 
WHERE tablename = 'products' 
  AND schemaname = 'public'
ORDER BY policyname;

-- 5. Check if RLS is enabled on products
SELECT 
  'RLS Status' as info,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'products' 
  AND schemaname = 'public';

-- 6. Test actual permissions (as current user)
SELECT 'Testing SELECT on products' as test;
SELECT COUNT(*) FROM public.products LIMIT 1;

SELECT 'Testing INSERT permission (dry run)' as test;
-- This would fail if no permission: INSERT INTO public.products (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING RETURNING id;

SELECT 'Testing UPDATE permission (dry run)' as test;
-- This would fail if no permission: UPDATE public.products SET title = title WHERE false RETURNING id;

SELECT 'Testing DELETE permission (dry run)' as test;
-- This would fail if no permission: DELETE FROM public.products WHERE false RETURNING id;
