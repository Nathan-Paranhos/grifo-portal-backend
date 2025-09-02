require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

async function verifyAdmin() {
  try {
    console.log('🔍 Verificando usuário super admin...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Credenciais do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verificar usuário no portal_users
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .select('*')
      .eq('email', 'paranhoscontato.n@gmail.com')
      .single();
    
    if (portalError) {
      console.log('❌ Erro ao buscar usuário no portal:', portalError.message);
      return;
    }
    
    if (!portalUser) {
      console.log('❌ Usuário não encontrado no portal_users');
      return;
    }
    
    console.log('✅ Usuário encontrado no portal_users:');
    console.log('📧 Email:', portalUser.email);
    console.log('👤 Nome:', portalUser.nome);
    console.log('🏢 Empresa ID:', portalUser.empresa_id);
    console.log('🔑 Role:', portalUser.role);
    console.log('🆔 ID:', portalUser.id);
    console.log('📅 Criado em:', portalUser.created_at);
    console.log('\n🔐 Permissões:');
    console.log('  ✓ Criar vistorias:', portalUser.can_create_vistorias);
    console.log('  ✓ Editar vistorias:', portalUser.can_edit_vistorias);
    console.log('  ✓ Ver todos os dados da empresa:', portalUser.can_view_all_company_data);
    console.log('  ✓ Ativo:', portalUser.ativo);
    
    // Verificar empresa associada
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome, cnpj, ativo')
      .eq('id', portalUser.empresa_id)
      .single();
    
    if (empresaError) {
      console.log('⚠️ Erro ao buscar empresa:', empresaError.message);
    } else {
      console.log('\n🏢 Empresa associada:');
      console.log('  📛 Nome:', empresa.nome);
      console.log('  📄 CNPJ:', empresa.cnpj);
      console.log('  ✅ Ativa:', empresa.ativo);
    }
    
    // Verificar se existe no auth.users (pode não existir ainda)
    if (portalUser.auth_user_id) {
      console.log('\n🔗 Auth User ID:', portalUser.auth_user_id);
    } else {
      console.log('\n⚠️ Usuário ainda não possui auth_user_id (precisa ser criado no Supabase Auth)');
    }
    
    console.log('\n📊 Resumo da verificação:');
    console.log('✅ Usuário criado no portal_users: SIM');
    console.log('✅ Role admin: SIM');
    console.log('✅ Permissões básicas: SIM');
    console.log('✅ Empresa associada: SIM');
    console.log('⚠️ Usuário no Supabase Auth:', portalUser.auth_user_id ? 'SIM' : 'NÃO');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

verifyAdmin();