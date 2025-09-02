require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userEmail = 'paranhoscontato.n@gmail.com';

async function finalCheck() {
  try {
    console.log('🔍 Verificação final do usuário...');
    console.log('📧 Email:', userEmail);
    console.log('');
    
    // 1. Verificar se existe no portal_users
    console.log('1️⃣ Verificando portal_users...');
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .select('*')
      .eq('email', userEmail)
      .single();
    
    if (portalError) {
      console.log('❌ Usuário não encontrado no portal_users:', portalError.message);
      return;
    }
    
    console.log('✅ Usuário encontrado no portal_users!');
    console.log('   - ID:', portalUser.id);
    console.log('   - Nome:', portalUser.nome);
    console.log('   - Role:', portalUser.role);
    console.log('   - Auth User ID:', portalUser.auth_user_id || 'NÃO VINCULADO');
    console.log('');
    
    // 2. Tentar buscar no auth.users usando nossa função
    console.log('2️⃣ Verificando auth.users...');
    const { data: authUsers, error: authError } = await supabase
      .rpc('get_auth_user_by_email', { user_email: userEmail });
    
    if (authError) {
      console.log('❌ Erro ao buscar no auth.users:', authError.message);
    } else if (authUsers && authUsers.length > 0) {
      const authUser = authUsers[0];
      console.log('✅ Usuário encontrado no auth.users!');
      console.log('   - Auth ID:', authUser.id);
      console.log('   - Email:', authUser.email);
      console.log('   - Criado em:', authUser.created_at);
      
      // Verificar se já está vinculado
      if (portalUser.auth_user_id === authUser.id) {
        console.log('');
        console.log('🎉 USUÁRIO JÁ ESTÁ COMPLETAMENTE CONFIGURADO!');
        console.log('✅ Existe no portal_users');
        console.log('✅ Existe no auth.users');
        console.log('✅ Vinculação está correta');
        return;
      }
      
      // Tentar vincular automaticamente
      console.log('');
      console.log('🔗 Tentando vincular automaticamente...');
      const { error: updateError } = await supabase
        .from('portal_users')
        .update({ auth_user_id: authUser.id })
        .eq('email', userEmail);
      
      if (updateError) {
        console.log('❌ Erro ao vincular:', updateError.message);
        console.log('');
        console.log('🛠️  SOLUÇÃO MANUAL:');
        console.log(`   UPDATE portal_users SET auth_user_id = '${authUser.id}' WHERE email = '${userEmail}';`);
      } else {
        console.log('✅ Vinculação realizada com sucesso!');
        console.log('');
        console.log('🎉 USUÁRIO AGORA ESTÁ COMPLETAMENTE CONFIGURADO!');
      }
    } else {
      console.log('❌ Usuário não encontrado no auth.users');
      console.log('');
      console.log('🛠️  SOLUÇÕES POSSÍVEIS:');
      console.log('1. Acesse: https://supabase.com/dashboard/project/fsvwifbvehdhlufauahj/auth/users');
      console.log('2. Clique em "Add user" ou "Invite user"');
      console.log('3. Use o email:', userEmail);
      console.log('4. Use a senha: Teste@2025');
      console.log('5. Após criar, execute este script novamente para vincular');
      console.log('');
      console.log('OU');
      console.log('');
      console.log('1. Se o usuário já existe mas não aparece, pode ser um problema de permissões');
      console.log('2. Tente fazer login no sistema com:', userEmail, '/ Teste@2025');
      console.log('3. Se conseguir fazer login, o usuário existe e será vinculado automaticamente');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

finalCheck().then(() => {
  console.log('');
  console.log('🏁 Verificação concluída');
}).catch(error => {
  console.error('❌ Erro na execução:', error.message);
});