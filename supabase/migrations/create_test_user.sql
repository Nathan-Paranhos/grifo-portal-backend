-- Inserir usuário de teste na tabela portal_users
INSERT INTO portal_users (
    email,
    nome,
    role,
    ativo,
    first_login_completed,
    can_create_vistorias,
    can_edit_vistorias,
    can_view_all_company_data
) VALUES (
    'paranhoscontato.n@gmail.com',
    'Nathan Paranhos',
    'admin',
    true,
    true,
    true,
    true,
    true
)
ON CONFLICT (email) DO UPDATE SET
    nome = EXCLUDED.nome,
    role = EXCLUDED.role,
    ativo = EXCLUDED.ativo,
    first_login_completed = EXCLUDED.first_login_completed,
    updated_at = now();