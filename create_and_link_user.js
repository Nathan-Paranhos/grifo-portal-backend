require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userEmail = 'paranhoscontato.n@gmail.com';
const userPassword = 'Teste@2025';

async function createAndLinkUser() {
  try {
    console.log('🔄 Tentando criar usuário no Supabase Auth...');
    
    // Tentar criar o usuário
    const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
      email: userEmail,
      password: userPassword,
      email_confirm: true
    });
    
    if (createError) {
      console.log('❌ Erro ao criar usuário:', createError.message);
      console.log('📋 Código do erro:', createError.status);
      
      // Se o erro for de usuário duplicado, tentar buscar o usuário existente
      if (createError.message.includes('duplicate key') || createError.message.includes('users_email_key')) {
        console.log('🔍 Usuário já existe, tentando buscar...');
        
        // Tentar buscar por email usando uma query SQL direta
        const { data: existingUsers, error: queryError } = await supabase
          .rpc('get_auth_user_by_email', { user_email: userEmail });
        
        if (queryError) {
          console.log('❌ Erro ao buscar usuário existente:', queryError.message);
          
          // Como último recurso, vamos tentar atualizar o portal_users sem auth_user_id
          console.log('🔄 Atualizando portal_users sem vincular auth...');
          const { data: portalUser, error: portalError } = await supabase
            .from('portal_users')
            .select('*')
            .eq('email', userEmail)
            .single();
          
          if (portalError) {
            console.log('❌ Erro ao buscar portal_user:', portalError.message);
          } else {
            console.log('✅ Portal user encontrado:', portalUser.id);
            console.log('📧 Email:', portalUser.email);
            console.log('👤 Nome:', portalUser.nome);
            console.log('🔑 Role:', portalUser.role);
            console.log('⚠️  Auth User ID:', portalUser.auth_user_id || 'Não vinculado');
            
            console.log('\n🎯 SOLUÇÃO RECOMENDADA:');
            console.log('1. Acesse o painel do Supabase Auth');
            console.log('2. Procure pelo usuário paranhoscontato.n@gmail.com');
            console.log('3. Se encontrar, copie o ID do usuário');
            console.log('4. Execute: UPDATE portal_users SET auth_user_id = \'<ID_COPIADO>\' WHERE email = \'paranhoscontato.n@gmail.com\';');
          }
        } else {
          console.log('✅ Usuário encontrado:', existingUsers);
        }
      }
    } else {
      console.log('✅ Usuário criado com sucesso!');
      console.log('📧 Email:', authUser.user.email);
      console.log('🆔 Auth ID:', authUser.user.id);
      
      // Vincular com portal_users
      const { data: updateResult, error: updateError } = await supabase
        .from('portal_users')
        .update({ auth_user_id: authUser.user.id })
        .eq('email', userEmail);
      
      if (updateError) {
        console.log('❌ Erro ao vincular com portal_users:', updateError.message);
      } else {
        console.log('✅ Usuário vinculado com portal_users!');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

createAndLinkUser().then(() => {
  console.log('🏁 Processo concluído');
}).catch(error => {
  console.error('❌ Erro na execução:', error.message);
});