-- Create missing storage buckets
-- This script creates the uploads, photos, and reports buckets

-- Create uploads bucket for general file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'uploads',
    'uploads',
    false,
    52428800, -- 50MB limit
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Create photos bucket specifically for inspection photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'photos',
    'photos',
    false,
    20971520, -- 20MB limit for photos
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Create reports bucket for generated reports and documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'reports',
    'reports',
    false,
    104857600, -- 100MB limit for reports
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for uploads bucket
CREATE POLICY "uploads_select_policy" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'uploads' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "uploads_insert_policy" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'uploads' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "uploads_update_policy" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'uploads' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "uploads_delete_policy" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'uploads' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

-- Create RLS policies for photos bucket
CREATE POLICY "photos_select_policy" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'photos' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "photos_insert_policy" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'photos' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "photos_update_policy" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'photos' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "photos_delete_policy" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'photos' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

-- Create RLS policies for reports bucket
CREATE POLICY "reports_select_policy" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'reports' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "reports_insert_policy" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'reports' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "reports_update_policy" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'reports' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

CREATE POLICY "reports_delete_policy" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'reports' AND
        (
            EXISTS (
                SELECT 1 FROM app_users au 
                WHERE au.auth_user_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM portal_users pu 
                WHERE pu.auth_user_id = auth.uid()
            )
        )
    );

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;