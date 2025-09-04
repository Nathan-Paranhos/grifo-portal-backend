-- Migração para criar usuário administrador de produção
-- Este script cria o tenant Grifo, empresa e usuário administrador

-- Criar tenant 'Grifo' se não existir
INSERT INTO tenants (
    name,
    slug,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Grifo',
    'grifo',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- Criar empresa 'Grifo Vistorias Ltda' se não existir
INSERT INTO empresas (
    nome,
    cnpj,
    endereco,
    telefone,
    email,
    created_at,
    updated_at
) VALUES (
    'Grifo Vistorias Ltda',
    '12.345.678/0001-90',
    'Rua das Vistorias, 123 - Centro',
    '(11) 99999-9999',
    'contato@grifo.com',
    NOW(),
    NOW()
)
ON CONFLICT (cnpj) DO NOTHING;

-- Criar entrada na tabela portal_users para o administrador
INSERT INTO portal_users (
    email,
    nome,
    role,
    empresa_id,
    ativo,
    created_at,
    updated_at
) 
SELECT 
    'admin@grifo.com',
    'Administrador Principal',
    'admin',
    e.id,
    true,
    NOW(),
    NOW()
FROM empresas e 
WHERE e.cnpj = '12.345.678/0001-90'
ON CONFLICT (email) DO NOTHING;