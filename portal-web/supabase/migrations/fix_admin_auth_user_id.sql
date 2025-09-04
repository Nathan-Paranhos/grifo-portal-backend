-- Fix admin user auth_user_id linkage
-- This script ensures the admin user has proper auth_user_id connection

DO $$
DECLARE
    admin_auth_id uuid;
    admin_portal_id uuid;
BEGIN
    -- Get the auth user ID for admin@grifo.com
    SELECT id INTO admin_auth_id 
    FROM auth.users 
    WHERE email = 'admin@grifo.com';
    
    -- Get the portal user ID for admin@grifo.com
    SELECT id INTO admin_portal_id 
    FROM portal_users 
    WHERE email = 'admin@grifo.com';
    
    -- Log current state
    RAISE NOTICE 'Auth user ID for admin@grifo.com: %', admin_auth_id;
    RAISE NOTICE 'Portal user ID for admin@grifo.com: %', admin_portal_id;
    
    -- If both exist, update the auth_user_id in portal_users
    IF admin_auth_id IS NOT NULL AND admin_portal_id IS NOT NULL THEN
        UPDATE portal_users 
        SET auth_user_id = admin_auth_id,
            first_login_completed = true,
            password_changed_at = NOW()
        WHERE id = admin_portal_id;
        
        RAISE NOTICE 'Updated portal_users auth_user_id for admin@grifo.com';
    ELSE
        RAISE NOTICE 'Could not find admin user in auth or portal_users tables';
    END IF;
    
    -- Verify the update
    SELECT auth_user_id INTO admin_auth_id 
    FROM portal_users 
    WHERE email = 'admin@grifo.com';
    
    RAISE NOTICE 'Portal user auth_user_id after update: %', admin_auth_id;
END $$;

-- Grant permissions to ensure the user can be accessed
GRANT SELECT, INSERT, UPDATE ON portal_users TO anon;
GRANT SELECT, INSERT, UPDATE ON portal_users TO authenticated;

-- Show final state
SELECT 
    pu.id as portal_user_id,
    pu.email,
    pu.nome,
    pu.auth_user_id,
    pu.ativo,
    pu.first_login_completed,
    au.id as auth_user_id,
    au.email as auth_email
FROM portal_users pu
LEFT JOIN auth.users au ON pu.auth_user_id = au.id
WHERE pu.email = 'admin@grifo.com';