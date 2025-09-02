const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './api/.env' });

// Configurações do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

// Cliente Supabase com service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createSuperAdmin() {
  try {
    console.log('🔍 Verificando usuários existentes...');
    
    // Verificar usuários existentes
    const { data: existingUsers, error: countError } = await supabase.auth.admin.listUsers();
    
    if (countError) {
      console.error('❌ Erro ao verificar usuários:', countError);
      return;
    }
    
    console.log(`📊 Total de usuários existentes: ${existingUsers.users.length}`);
    
    // Limpar usuários existentes se houver
    if (existingUsers.users.length > 0) {
      console.log('🧹 Removendo usuários existentes...');
      
      for (const user of existingUsers.users) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.error(`❌ Erro ao deletar usuário ${user.email}:`, deleteError);
        } else {
          console.log(`✅ Usuário ${user.email} removido`);
        }
      }
    }
    
    // Limpar tabelas relacionadas
    console.log('🧹 Limpando tabelas relacionadas...');
    
    const { error: deletePortalError } = await supabase
      .from('portal_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deletePortalError) {
      console.error('❌ Erro ao limpar portal_users:', deletePortalError);
    } else {
      console.log('✅ Tabela portal_users limpa');
    }
    
    const { error: deleteAppError } = await supabase
      .from('app_users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteAppError) {
      console.error('❌ Erro ao limpar app_users:', deleteAppError);
    } else {
      console.log('✅ Tabela app_users limpa');
    }
    
    // Verificar se existe empresa
    console.log('🏢 Verificando empresas...');
    const { data: empresas, error: empresaError } = await supabase
      .from('empresas')
      .select('id, nome')
      .limit(1);
    
    let empresaId;
    
    if (empresaError || !empresas || empresas.length === 0) {
      console.log('🏢 Criando empresa padrão...');
      
      const { data: newEmpresa, error: createEmpresaError } = await supabase
        .from('empresas')
        .insert({
          nome: 'Grifo Vistorias',
          cnpj: '00.000.000/0001-00',
          endereco: 'Endereço Padrão',
          telefone: '(00) 00000-0000',
          email: 'contato@grifo.com'
        })
        .select()
        .single();
      
      if (createEmpresaError) {
        console.error('❌ Erro ao criar empresa:', createEmpresaError);
        return;
      }
      
      empresaId = newEmpresa.id;
      console.log(`✅ Empresa criada: ${newEmpresa.nome} (ID: ${empresaId})`);
    } else {
      empresaId = empresas[0].id;
      console.log(`✅ Empresa encontrada: ${empresas[0].nome} (ID: ${empresaId})`);
    }
    
    // Aguardar um pouco antes de criar o usuário
    console.log('⏳ Aguardando 2 segundos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Criar usuário super admin com método alternativo
    console.log('👤 Criando usuário super admin...');
    
    try {
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: 'paranhoscontato.n@gmail.com',
        password: 'Teste@2025',
        email_confirm: true,
        user_metadata: {
          name: 'Super Admin',
          role: 'admin'
        }
      });
      
      if (createUserError) {
        console.error('❌ Erro ao criar usuário no auth:', createUserError);
        
        // Tentar método alternativo - verificar se já existe
        console.log('🔄 Tentando verificar se usuário já existe...');
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const userExists = existingUser.users.find(u => u.email === 'paranhoscontato.n@gmail.com');
        
        if (userExists) {
          console.log('✅ Usuário já existe, usando existente');
          
          // Criar registro no portal_users
          console.log('📝 Criando registro no portal_users...');
          
          const { data: portalUser, error: portalUserError } = await supabase
            .from('portal_users')
            .insert({
              auth_user_id: userExists.id,
              email: 'paranhoscontato.n@gmail.com',
              nome: 'Super Admin',
              empresa_id: empresaId,
              role: 'admin',
              can_create_vistorias: true,
              can_edit_vistorias: true,
              can_view_all_company_data: true,
              can_manage_users: true,
              ativo: true
            })
            .select()
            .single();
          
          if (portalUserError) {
            console.error('❌ Erro ao criar registro no portal_users:', portalUserError);
            return;
          }
          
          console.log(`✅ Registro criado no portal_users (ID: ${portalUser.id})`);
        } else {
          return;
        }
      } else {
        console.log(`✅ Usuário criado no auth: ${newUser.user.email} (ID: ${newUser.user.id})`);
        
        // Criar registro no portal_users
        console.log('📝 Criando registro no portal_users...');
        
        const { data: portalUser, error: portalUserError } = await supabase
          .from('portal_users')
          .insert({
            auth_user_id: newUser.user.id,
            email: 'paranhoscontato.n@gmail.com',
            nome: 'Super Admin',
            empresa_id: empresaId,
            role: 'admin',
            can_create_vistorias: true,
            can_edit_vistorias: true,
            can_view_all_company_data: true,
            can_manage_users: true,
            ativo: true
          })
          .select()
          .single();
        
        if (portalUserError) {
          console.error('❌ Erro ao criar registro no portal_users:', portalUserError);
          return;
        }
        
        console.log(`✅ Registro criado no portal_users (ID: ${portalUser.id})`);
      }
    } catch (authError) {
      console.error('❌ Erro na criação do usuário:', authError);
      return;
    }
    
    // Verificação final
    console.log('\n🔍 VERIFICAÇÃO FINAL:');
    
    const { data: finalUsers } = await supabase.auth.admin.listUsers();
    console.log(`📊 Total de usuários no auth: ${finalUsers.users.length}`);
    
    const { data: finalPortalUsers } = await supabase
      .from('portal_users')
      .select('*');
    console.log(`📊 Total de usuários no portal: ${finalPortalUsers?.length || 0}`);
    
    const { data: finalAppUsers } = await supabase
      .from('app_users')
      .select('*');
    console.log(`📊 Total de usuários no app: ${finalAppUsers?.length || 0}`);
    
    // Verificar se o usuário específico foi criado
    const { data: createdUser } = await supabase
      .from('portal_users')
      .select('*')
      .eq('email', 'paranhoscontato.n@gmail.com')
      .single();
    
    if (createdUser) {
      console.log('\n🎉 SUPER ADMIN CRIADO COM SUCESSO!');
      console.log('📧 Email: paranhoscontato.n@gmail.com');
      console.log('🔑 Senha: Teste@2025');
      console.log('👑 Role: admin (com todas as permissões)');
      console.log(`🏢 Empresa ID: ${createdUser.empresa_id}`);
      console.log(`🆔 Portal User ID: ${createdUser.id}`);
      console.log(`🔗 Auth User ID: ${createdUser.auth_user_id}`);
    } else {
      console.log('❌ Usuário não foi encontrado após criação');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

// Executar a função
createSuperAdmin().then(() => {
  console.log('\n✅ Script finalizado');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Erro na execução:', error);
  process.exit(1);
});