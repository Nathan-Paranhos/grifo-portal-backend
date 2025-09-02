# 🔐 Instruções para Criar Usuário no Supabase Auth Manualmente

## ❌ Problema Identificado

O script automatizado está falhando ao criar usuários no Supabase Auth com o erro:
```
Database error creating new user
Status: 500, Code: unexpected_failure
```

Este erro indica um problema no banco de dados do Supabase Auth que impede a criação programática de usuários.

## ✅ Usuário Já Criado no Sistema

**O usuário já foi criado com sucesso na tabela `portal_users`:**

- 📧 **Email**: `paranhoscontato.n@gmail.com`
- 👤 **Nome**: Super Admin
- 🔑 **Role**: admin
- 🏢 **Empresa**: Grifo Vistorias
- ✅ **Permissões**: Todas habilitadas
- 🆔 **Portal User ID**: `2a8b7a49-0e81-43b2-acdf-c104958820c6`

## 🛠️ Solução Manual

### Opção 1: Painel do Supabase (Recomendado)

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Vá para o projeto do Grifo Vistorias
3. Navegue para **Authentication > Users**
4. Clique em **Add User**
5. Preencha:
   - **Email**: `paranhoscontato.n@gmail.com`
   - **Password**: `Teste@2025`
   - **Email Confirm**: ✅ Marcar como confirmado
6. Após criar, copie o **User ID** gerado
7. Execute o script de atualização abaixo

### Opção 2: SQL Direto (Avançado)

Se tiver acesso direto ao banco PostgreSQL:

```sql
-- Inserir usuário na tabela auth.users
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_confirm_token_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  gen_random_uuid(),
  'paranhoscontato.n@gmail.com',
  crypt('Teste@2025', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  now(),
  '',
  now(),
  '',
  '',
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  false,
  'authenticated'
);
```

## 🔄 Script de Atualização

Após criar o usuário no Supabase Auth, execute este script para vincular:

```javascript
// update_auth_link.js
require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

async function updateAuthLink() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Buscar usuário no auth.users
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.log('Erro ao buscar usuários:', authError.message);
    return;
  }
  
  const authUser = authUsers.users.find(u => u.email === 'paranhoscontato.n@gmail.com');
  
  if (!authUser) {
    console.log('Usuário não encontrado no auth.users');
    return;
  }
  
  // Atualizar portal_users com auth_user_id
  const { error: updateError } = await supabase
    .from('portal_users')
    .update({ auth_user_id: authUser.id })
    .eq('email', 'paranhoscontato.n@gmail.com');
  
  if (updateError) {
    console.log('Erro ao atualizar:', updateError.message);
  } else {
    console.log('✅ Usuário vinculado com sucesso!');
    console.log('Auth User ID:', authUser.id);
  }
}

updateAuthLink();
```

## 📋 Checklist Final

- [ ] Criar usuário no painel do Supabase Auth
- [ ] Executar script de vinculação
- [ ] Testar login no sistema
- [ ] Verificar permissões de admin

## 🎯 Credenciais de Login

- **Email**: `paranhoscontato.n@gmail.com`
- **Senha**: `Teste@2025`
- **Role**: Admin com todas as permissões

---

**Nota**: O problema parece estar relacionado à configuração do banco de dados do Supabase Auth ou limitações da conta. A criação manual através do painel é a solução mais confiável.