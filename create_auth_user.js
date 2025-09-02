require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

async function createAuthUser() {
  try {
    console.log('🔐 Criando usuário no Supabase Auth...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Credenciais do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    const email = 'paranhoscontato.n@gmail.com';
    const password = 'Teste@2025';
    
    console.log('📧 Email:', email);
    console.log('🔑 Tentando criar usuário...');
    
    // Primeiro, verificar se o usuário já existe no portal_users
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .select('id, auth_user_id')
      .eq('email', email)
      .single();
    
    if (portalError) {
      console.log('❌ Usuário não encontrado no portal_users:', portalError.message);
      return;
    }
    
    if (portalUser.auth_user_id) {
      console.log('✅ Usuário já possui auth_user_id:', portalUser.auth_user_id);
      return;
    }
    
    // Tentar criar usuário usando signUp (método alternativo)
    console.log('🔄 Tentando método signUp...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        emailRedirectTo: undefined,
        data: {
          email_confirm: true
        }
      }
    });
    
    if (signUpError) {
      console.log('❌ Erro no signUp:', signUpError.message);
      
      // Tentar método admin createUser com configurações diferentes
      console.log('🔄 Tentando método admin createUser...');
      const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          created_by: 'admin_script'
        }
      });
      
      if (adminError) {
        console.log('❌ Erro no admin createUser:', adminError.message);
        console.log('❌ Código:', adminError.status);
        console.log('❌ Detalhes:', JSON.stringify(adminError, null, 2));
        return;
      }
      
      if (adminData?.user) {
        console.log('✅ Usuário criado via admin createUser!');
        console.log('🆔 Auth User ID:', adminData.user.id);
        
        // Atualizar portal_users com o auth_user_id
        const { error: updateError } = await supabase
          .from('portal_users')
          .update({ auth_user_id: adminData.user.id })
          .eq('id', portalUser.id);
        
        if (updateError) {
          console.log('⚠️ Erro ao atualizar portal_users:', updateError.message);
        } else {
          console.log('✅ portal_users atualizado com auth_user_id');
        }
      }
    } else if (signUpData?.user) {
      console.log('✅ Usuário criado via signUp!');
      console.log('🆔 Auth User ID:', signUpData.user.id);
      
      // Atualizar portal_users com o auth_user_id
      const { error: updateError } = await supabase
        .from('portal_users')
        .update({ auth_user_id: signUpData.user.id })
        .eq('id', portalUser.id);
      
      if (updateError) {
        console.log('⚠️ Erro ao atualizar portal_users:', updateError.message);
      } else {
        console.log('✅ portal_users atualizado com auth_user_id');
      }
    }
    
    // Verificação final
    const { data: finalUser, error: finalError } = await supabase
      .from('portal_users')
      .select('id, email, nome, auth_user_id')
      .eq('email', email)
      .single();
    
    if (finalError) {
      console.log('❌ Erro na verificação final:', finalError.message);
    } else {
      console.log('\n📊 Status Final:');
      console.log('✅ Portal User ID:', finalUser.id);
      console.log('✅ Email:', finalUser.email);
      console.log('✅ Nome:', finalUser.nome);
      console.log('✅ Auth User ID:', finalUser.auth_user_id || 'NÃO DEFINIDO');
      
      if (finalUser.auth_user_id) {
        console.log('\n🎉 SUCESSO! Usuário completamente configurado!');
        console.log('📧 Email de login:', email);
        console.log('🔑 Senha:', password);
      } else {
        console.log('\n⚠️ Usuário existe no portal mas não no auth');
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
}

createAuthUser();