require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

async function updateAuthLink() {
  try {
    console.log('🔗 Vinculando usuário do Auth com Portal...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Credenciais do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const email = 'paranhoscontato.n@gmail.com';
    
    console.log('📧 Buscando usuário:', email);
    
    // Buscar usuário no auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('❌ Erro ao buscar usuários no auth:', authError.message);
      return;
    }
    
    console.log('👥 Total de usuários no auth:', authUsers.users.length);
    
    const authUser = authUsers.users.find(u => u.email === email);
    
    if (!authUser) {
      console.log('❌ Usuário não encontrado no auth.users');
      console.log('📋 Usuários disponíveis:');
      authUsers.users.forEach(u => {
        console.log(`  - ${u.email} (ID: ${u.id})`);
      });
      return;
    }
    
    console.log('✅ Usuário encontrado no auth.users:');
    console.log('🆔 Auth User ID:', authUser.id);
    console.log('📧 Email:', authUser.email);
    console.log('📅 Criado em:', authUser.created_at);
    console.log('✅ Email confirmado:', authUser.email_confirmed_at ? 'SIM' : 'NÃO');
    
    // Buscar usuário no portal_users
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .select('id, email, nome, auth_user_id')
      .eq('email', email)
      .single();
    
    if (portalError) {
      console.log('❌ Usuário não encontrado no portal_users:', portalError.message);
      return;
    }
    
    console.log('\n✅ Usuário encontrado no portal_users:');
    console.log('🆔 Portal User ID:', portalUser.id);
    console.log('👤 Nome:', portalUser.nome);
    console.log('🔗 Auth User ID atual:', portalUser.auth_user_id || 'NÃO DEFINIDO');
    
    if (portalUser.auth_user_id === authUser.id) {
      console.log('\n✅ Usuário já está vinculado corretamente!');
      return;
    }
    
    // Atualizar portal_users com auth_user_id
    console.log('\n🔄 Vinculando usuários...');
    const { error: updateError } = await supabase
      .from('portal_users')
      .update({ auth_user_id: authUser.id })
      .eq('email', email);
    
    if (updateError) {
      console.log('❌ Erro ao atualizar portal_users:', updateError.message);
      return;
    }
    
    console.log('✅ Usuário vinculado com sucesso!');
    
    // Verificação final
    const { data: finalUser, error: finalError } = await supabase
      .from('portal_users')
      .select('id, email, nome, auth_user_id, role, empresa_id')
      .eq('email', email)
      .single();
    
    if (finalError) {
      console.log('❌ Erro na verificação final:', finalError.message);
    } else {
      console.log('\n🎉 CONFIGURAÇÃO COMPLETA!');
      console.log('📊 Status Final:');
      console.log('✅ Portal User ID:', finalUser.id);
      console.log('✅ Auth User ID:', finalUser.auth_user_id);
      console.log('✅ Email:', finalUser.email);
      console.log('✅ Nome:', finalUser.nome);
      console.log('✅ Role:', finalUser.role);
      console.log('✅ Empresa ID:', finalUser.empresa_id);
      
      console.log('\n🔑 Credenciais de Login:');
      console.log('📧 Email:', email);
      console.log('🔐 Senha: Teste@2025');
      console.log('\n🌐 O usuário agora pode fazer login no sistema!');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('❌ Stack:', error.stack);
    process.exit(1);
  }
}

updateAuthLink();