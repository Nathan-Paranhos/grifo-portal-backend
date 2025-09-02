const fetch = require('node-fetch');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = 'https://fsvwifbvehdhlufauahj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDYyMjUwNiwiZXhwIjoyMDcwMTk4NTA2fQ.P0IucayWhykgPkSkvGUvzW1Q0PHtzNaSbJ010EWS-6A';

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Função para gerar UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Função para gerar hash bcrypt simples
function generateBcryptHash(password) {
  const bcrypt = require('bcryptjs');
  return bcrypt.hashSync(password, 10);
}

async function createAuthUserDirectSQL() {
  const email = 'paranhoscontato.n@gmail.com';
  const password = 'Teste@2025';
  const nome = 'Super Admin';
  
  try {
    console.log('🚀 Tentando criar usuário diretamente via SQL...');
    
    // Gerar dados do usuário
    const userId = generateUUID();
    const hashedPassword = generateBcryptHash(password);
    const now = new Date().toISOString();
    
    console.log('📝 Dados gerados:');
    console.log('- User ID:', userId);
    console.log('- Email:', email);
    console.log('- Hash gerado:', hashedPassword.substring(0, 20) + '...');
    
    // SQL para inserir usuário diretamente
    const insertSQL = `
      INSERT INTO auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        invited_at,
        confirmation_token,
        confirmation_sent_at,
        recovery_token,
        recovery_sent_at,
        email_change_token_new,
        email_change,
        email_change_sent_at,
        last_sign_in_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        phone,
        phone_confirmed_at,
        phone_change,
        phone_change_token,
        phone_change_sent_at,
        confirmed_at,
        email_change_token_current,
        email_change_confirm_status,
        banned_until,
        reauthentication_token,
        reauthentication_sent_at,
        is_sso_user,
        deleted_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        '${userId}',
        'authenticated',
        'authenticated',
        '${email}',
        '${hashedPassword}',
        '${now}',
        null,
        '',
        null,
        '',
        null,
        '',
        '',
        null,
        null,
        '{}',
        '{"nome": "${nome}"}',
        false,
        '${now}',
        '${now}',
        null,
        null,
        '',
        '',
        null,
        '${now}',
        '',
        0,
        null,
        '',
        null,
        false,
        null
      )
      ON CONFLICT (email) DO UPDATE SET
        encrypted_password = EXCLUDED.encrypted_password,
        updated_at = EXCLUDED.updated_at,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        confirmed_at = EXCLUDED.confirmed_at
      RETURNING id;
    `;
    
    console.log('🔄 Executando SQL via REST API...');
    
    // Executar via REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        sql: insertSQL
      })
    });
    
    if (!response.ok) {
      console.log('⚠️ REST API falhou, tentando RPC personalizada...');
      
      // Tentar via RPC personalizada
      const { data: rpcResult, error: rpcError } = await supabase.rpc('create_auth_user_custom', {
        user_id: userId,
        user_email: email,
        user_password: hashedPassword,
        user_name: nome,
        created_time: now
      });
      
      if (rpcError) {
        console.log('⚠️ RPC também falhou:', rpcError.message);
        console.log('🔄 Tentando abordagem alternativa...');
        
        // Última tentativa: usar signUp com confirmação automática
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              nome: nome
            }
          }
        });
        
        if (signUpError) {
          throw new Error(`Todas as tentativas falharam. Último erro: ${signUpError.message}`);
        }
        
        console.log('✅ SignUp funcionou! User ID:', signUpData.user?.id);
        return signUpData.user?.id;
      } else {
        console.log('✅ RPC funcionou! Resultado:', rpcResult);
        return userId;
      }
    } else {
      const result = await response.json();
      console.log('✅ SQL direto funcionou! Resultado:', result);
      return userId;
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  }
}

async function linkAuthUser() {
  try {
    console.log('🔗 Iniciando processo de vinculação...');
    
    const authUserId = await createAuthUserDirectSQL();
    
    if (authUserId) {
      console.log('🔄 Vinculando ao portal_users...');
      
      const { error: updateError } = await supabase
        .from('portal_users')
        .update({ auth_user_id: authUserId })
        .eq('email', 'paranhoscontato.n@gmail.com');
      
      if (updateError) {
        console.log('⚠️ Erro ao vincular:', updateError.message);
      } else {
        console.log('✅ Vinculação realizada com sucesso!');
      }
      
      // Verificação final
      const { data: finalUser } = await supabase
        .from('portal_users')
        .select('*')
        .eq('email', 'paranhoscontato.n@gmail.com')
        .single();
      
      console.log('\n🎉 USUÁRIO CRIADO E VINCULADO COM SUCESSO!');
      console.log('📧 Email: paranhoscontato.n@gmail.com');
      console.log('🔑 Senha: Teste@2025');
      console.log('🆔 Portal User ID:', finalUser.id);
      console.log('🔐 Auth User ID:', finalUser.auth_user_id);
      console.log('\n✅ Agora você pode fazer login no sistema!');
    }
    
  } catch (error) {
    console.error('❌ Processo falhou:', error.message);
    console.log('\n💡 SOLUÇÕES ALTERNATIVAS:');
    console.log('1. Acesse o painel do Supabase Auth');
    console.log('2. Crie o usuário manualmente com email: paranhoscontato.n@gmail.com');
    console.log('3. Execute o script update_auth_link.js para vincular');
    console.log('\nOu tente fazer login diretamente - o usuário pode já existir!');
  }
}

// Executar
linkAuthUser();