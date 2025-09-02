require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAuthUserDirect() {
  try {
    console.log('🔍 Criando usuário diretamente no Supabase Auth...');
    
    const email = 'paranhoscontato.n@gmail.com';
    const password = 'Teste@2025';
    
    // Primeiro, verificar se o usuário já existe
    console.log('📧 Verificando se usuário já existe...');
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError);
      return;
    }
    
    const existingUser = existingUsers.users.find(user => user.email === email);
    if (existingUser) {
      console.log('✅ Usuário já existe no auth!');
      console.log(`   Auth User ID: ${existingUser.id}`);
      
      // Vincular com portal_users
      const { error: updateError } = await supabase
        .from('portal_users')
        .update({ auth_user_id: existingUser.id })
        .eq('email', email);
        
      if (updateError) {
        console.error('❌ Erro ao vincular usuário:', updateError);
      } else {
        console.log('✅ Usuário vinculado com sucesso!');
      }
      return;
    }
    
    console.log('👤 Criando novo usuário...');
    
    // Tentar criar usuário com admin.createUser
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        name: 'Administrador Sistema'
      }
    });
    
    if (createError) {
      console.error('❌ Erro ao criar usuário com admin.createUser:', createError);
      
      // Tentar método alternativo - signUp
      console.log('🔄 Tentando método alternativo...');
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            name: 'Administrador Sistema'
          }
        }
      });
      
      if (signUpError) {
        console.error('❌ Erro ao criar usuário com signUp:', signUpError);
        return;
      }
      
      if (signUpData.user) {
        console.log('✅ Usuário criado com signUp!');
        console.log(`   Auth User ID: ${signUpData.user.id}`);
        
        // Vincular com portal_users
        const { error: updateError } = await supabase
          .from('portal_users')
          .update({ auth_user_id: signUpData.user.id })
          .eq('email', email);
          
        if (updateError) {
          console.error('❌ Erro ao vincular usuário:', updateError);
        } else {
          console.log('✅ Usuário vinculado com sucesso!');
        }
      }
    } else {
      console.log('✅ Usuário criado com admin.createUser!');
      console.log(`   Auth User ID: ${newUser.user.id}`);
      
      // Vincular com portal_users
      const { error: updateError } = await supabase
        .from('portal_users')
        .update({ auth_user_id: newUser.user.id })
        .eq('email', email);
        
      if (updateError) {
        console.error('❌ Erro ao vincular usuário:', updateError);
      } else {
        console.log('✅ Usuário vinculado com sucesso!');
      }
    }
    
    // Verificar resultado final
    console.log('\n🔍 Verificação final...');
    const { data: finalUsers, error: finalError } = await supabase.auth.admin.listUsers();
    
    if (finalError) {
      console.error('❌ Erro na verificação final:', finalError);
    } else {
      console.log(`👥 Total de usuários no auth: ${finalUsers.users.length}`);
      const finalUser = finalUsers.users.find(user => user.email === email);
      if (finalUser) {
        console.log('✅ Usuário confirmado no auth!');
        console.log(`   ID: ${finalUser.id}`);
        console.log(`   Email: ${finalUser.email}`);
        console.log(`   Confirmado: ${finalUser.email_confirmed_at ? 'Sim' : 'Não'}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

createAuthUserDirect();