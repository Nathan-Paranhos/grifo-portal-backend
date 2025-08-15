-- Create missing storage buckets (simplified version)
-- This script creates the uploads, photos, and reports buckets without RLS policies

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