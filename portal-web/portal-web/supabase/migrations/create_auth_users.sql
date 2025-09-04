-- Criar usuários de teste no Supabase Auth usando a função auth.signup
-- Esta é a forma recomendada de criar usuários no Supabase

-- Função para criar usuário com senha
CREATE OR REPLACE FUNCTION create_test_user(user_email text, user_password text, user_name text, user_role text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid;
  existing_user_id uuid;
BEGIN
  -- Verificar se o usuário já existe
  SELECT id INTO existing_user_id FROM auth.users WHERE email = user_email;
  
  IF existing_user_id IS NOT NULL THEN
    RETURN existing_user_id;
  END IF;
  
  -- Criar novo usuário
  new_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmed_at
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('name', user_name),
    false,
    NOW()
  );
  
  -- Criar identidade
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', user_email,
      'email_verified', true
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );
  
  -- Criar registro na tabela public.users
  INSERT INTO public.users (
    id,
    auth_user_id,
    name,
    email,
    role,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    user_name,
    user_email,
    user_role,
    NOW(),
    NOW()
  );
  
  RETURN new_user_id;
END;
$$;

-- Criar usuários de teste
SELECT create_test_user('visionariaev@gmail.com', '123456', 'Visionaria Admin', 'admin');
SELECT create_test_user('paranhoscontato.n@gmail.com', '123456', 'Paranhos User', 'client');

-- Remover a função temporária
DROP FUNCTION create_test_user(text, text, text, text);