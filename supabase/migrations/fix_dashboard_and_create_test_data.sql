-- Fix dashboard authentication mapping and create test data
-- This migration ensures the dashboard works properly by:
-- 1. Creating necessary tables if they don't exist
-- 2. Adding test data for dashboard functionality
-- 3. Ensuring proper user-company mapping

-- First, let's check and create missing tables
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES empresas(id),
    address TEXT NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES empresas(id),
    property_id UUID REFERENCES properties(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contestations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES empresas(id),
    inspection_id UUID REFERENCES inspections(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES empresas(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Get the empresa_id for our test user
DO $$
DECLARE
    test_empresa_id UUID;
    test_property_id UUID;
    test_inspection_id UUID;
BEGIN
    -- Get the empresa_id from our test user
    SELECT empresa_id INTO test_empresa_id 
    FROM portal_users 
    WHERE email = 'teste@grifo.com' 
    LIMIT 1;
    
    IF test_empresa_id IS NULL THEN
        RAISE NOTICE 'Test user not found, using default empresa';
        SELECT id INTO test_empresa_id FROM empresas WHERE nome = 'Grifo Admin' LIMIT 1;
    END IF;
    
    IF test_empresa_id IS NOT NULL THEN
        RAISE NOTICE 'Using empresa_id: %', test_empresa_id;
        
        -- Insert test properties
        INSERT INTO properties (company_id, address, status) VALUES
        (test_empresa_id, 'Rua das Flores, 123 - São Paulo/SP', 'active'),
        (test_empresa_id, 'Av. Paulista, 456 - São Paulo/SP', 'active'),
        (test_empresa_id, 'Rua Augusta, 789 - São Paulo/SP', 'inactive')
        ON CONFLICT DO NOTHING;
        
        -- Get a property ID for inspections
        SELECT id INTO test_property_id FROM properties WHERE company_id = test_empresa_id LIMIT 1;
        
        -- Insert test inspections
        INSERT INTO inspections (company_id, property_id, status) VALUES
        (test_empresa_id, test_property_id, 'pending'),
        (test_empresa_id, test_property_id, 'completed'),
        (test_empresa_id, test_property_id, 'completed'),
        (test_empresa_id, test_property_id, 'cancelled')
        ON CONFLICT DO NOTHING;
        
        -- Get an inspection ID for contestations
        SELECT id INTO test_inspection_id FROM inspections WHERE company_id = test_empresa_id LIMIT 1;
        
        -- Insert test contestations
        INSERT INTO contestations (company_id, inspection_id, status, reason) VALUES
        (test_empresa_id, test_inspection_id, 'pending', 'Discordo do resultado da vistoria'),
        (test_empresa_id, test_inspection_id, 'approved', 'Solicitação de revisão')
        ON CONFLICT DO NOTHING;
        
        -- Insert test users
        INSERT INTO users (company_id, name, email, status) VALUES
        (test_empresa_id, 'João Silva', 'joao@grifo.com', 'active'),
        (test_empresa_id, 'Maria Santos', 'maria@grifo.com', 'active'),
        (test_empresa_id, 'Pedro Costa', 'pedro@grifo.com', 'inactive')
        ON CONFLICT (email) DO NOTHING;
        
        RAISE NOTICE 'Test data created successfully for empresa: %', test_empresa_id;
    ELSE
        RAISE NOTICE 'No empresa found, skipping test data creation';
    END IF;
END $$;

-- Grant permissions to anon and authenticated roles
GRANT SELECT ON properties TO anon, authenticated;
GRANT SELECT ON inspections TO anon, authenticated;
GRANT SELECT ON contestations TO anon, authenticated;
GRANT SELECT ON users TO anon, authenticated;