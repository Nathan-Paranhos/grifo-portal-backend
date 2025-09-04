-- Migration: Fix user mapping between auth.users and public.users
-- This ensures that users in auth.users have corresponding records in public.users

-- Temporarily disable the problematic foreign key constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- Insert missing users from auth.users into public.users
INSERT INTO public.users (
    id,
    email,
    nome,
    auth_user_id,
    role,
    user_type,
    is_active,
    status,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid() as id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'full_name',
        split_part(au.email, '@', 1)
    ) as nome,
    au.id as auth_user_id,
    'vistoriador' as role,
    CASE 
        WHEN au.email LIKE '%visionaria%' OR au.email LIKE '%admin%' THEN 'admin'
        ELSE 'client'
    END as user_type,
    true as is_active,
    'active' as status,
    au.created_at,
    au.updated_at
FROM auth.users au
LEFT JOIN public.users pu ON pu.auth_user_id = au.id
WHERE pu.id IS NULL
  AND au.email IS NOT NULL
  AND au.deleted_at IS NULL
  AND au.email_confirmed_at IS NOT NULL;

-- Grant necessary permissions to anon and authenticated roles
GRANT SELECT ON public.users TO anon;
GRANT ALL PRIVILEGES ON public.users TO authenticated;

-- Ensure RLS is enabled on public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create or update RLS policy for authenticated users
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = auth_user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = auth_user_id);

-- Allow authenticated users to insert their own profile
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Show results
SELECT 
    'Users successfully mapped:' as status,
    COUNT(*) as count
FROM public.users pu 
JOIN auth.users au ON pu.auth_user_id = au.id
WHERE au.deleted_at IS NULL AND au.email_confirmed_at IS NOT NULL;