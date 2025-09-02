require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

async function createPortalAdmin() {
  try {
    console.log('🔧 Carregando configurações...');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Credenciais do Supabase não encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🧹 Limpando usuários existentes...');
    
    // Limpar portal_users
    const { error: deletePortalError } = await supabase
      .from('portal_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deletePortalError) {
      console.log('⚠️ Aviso ao limpar portal_users:', deletePortalError.message);
    } else {
      console.log('✅ Tabela portal_users limpa');
    }
    
    // Limpar app_users
    const { error: deleteAppError } = await supabase
      .from('app_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteAppError) {
      console.log('⚠️ Aviso ao limpar app_users:', deleteAppError.message);
    } else {
      console.log('✅ Tabela app_users limpa');
    }
    
    console.log('🏢 Verificando empresa padrão...');
    
    // Verificar se empresa existe
    let { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome')
      .eq('nome', 'Grifo Vistorias')
      .single();
    
    if (empresaError && empresaError.code === 'PGRST116') {
      // Empresa não existe, criar
      console.log('🏗️ Criando empresa padrão...');
      const { data: novaEmpresa, error: criarEmpresaError } = await supabase
        .from('empresas')
        .insert({
          nome: 'Grifo Vistorias',
          cnpj: '12.345.678/0001-90',
          ativo: true
        })
        .select()
        .single();
      
      if (criarEmpresaError) {
        throw new Error(`Erro ao criar empresa: ${criarEmpresaError.message}`);
      }
      
      empresa = novaEmpresa;
      console.log('✅ Empresa criada:', empresa.nome);
    } else if (empresaError) {
      throw new Error(`Erro ao buscar empresa: ${empresaError.message}`);
    } else {
      console.log('✅ Empresa encontrada:', empresa.nome, '(ID:', empresa.id + ')');
    }
    
    console.log('👤 Criando usuário no portal...');
    
    // Criar usuário no portal_users
    const { data: portalUser, error: portalError } = await supabase
      .from('portal_users')
      .insert({
        email: 'paranhoscontato.n@gmail.com',
        nome: 'Super Admin',
        empresa_id: empresa.id,
        role: 'admin',
        can_create_vistorias: true,
        can_edit_vistorias: true,
        can_view_all_company_data: true,
        ativo: true
      })
      .select()
      .single();
    
    if (portalError) {
      throw new Error(`Erro ao criar usuário no portal: ${portalError.message}`);
    }
    
    console.log('✅ Usuário criado no portal com sucesso!');
    console.log('📧 Email:', portalUser.email);
    console.log('👤 Nome:', portalUser.nome);
    console.log('🏢 Empresa ID:', portalUser.empresa_id);
    console.log('🔑 Role:', portalUser.role);
    console.log('🆔 Portal User ID:', portalUser.id);
    
    console.log('\n📊 Verificação final...');
    
    // Contar usuários finais
    const { count: portalCount } = await supabase
      .from('portal_users')
      .select('*', { count: 'exact', head: true });
    
    const { count: appCount } = await supabase
      .from('app_users')
      .select('*', { count: 'exact', head: true });
    
    console.log('📈 Total portal_users:', portalCount);
    console.log('📈 Total app_users:', appCount);
    
    console.log('\n✅ Usuário super admin criado com sucesso!');
    console.log('📧 Para fazer login, use: paranhoscontato.n@gmail.com');
    console.log('🔐 Senha temporária: Teste@2025');
    console.log('⚠️ IMPORTANTE: Você precisará criar este usuário no Supabase Auth manualmente ou através do painel administrativo.');
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

createPortalAdmin();