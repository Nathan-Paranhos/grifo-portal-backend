const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase com service_role key
const supabaseUrl = 'https://fsvwifbvehdhlufauahj.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDYyMjUwNiwiZXhwIjoyMDcwMTk4NTA2fQ.P0IucayWhykgPkSkvGUvzW1Q0PHtzNaSbJ010EWS-6A';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createSuperAdminComplete() {
  const email = 'paranhoscontato.n@gmail.com';
  const password = 'Teste@2025';
  const nome = 'Super Admin';
  
  try {
    console.log('🚀 Iniciando criação completa do super admin...');
    
    // 1. Verificar se já existe no portal_users
    console.log('📋 Verificando usuário existente no portal_users...');
    const { data: existingPortalUser } = await supabase
      .from('portal_users')
      .select('*')
      .eq('email', email)
      .single();
    
    let portalUserId;
    let empresaId;
    
    if (existingPortalUser) {
      console.log('✅ Usuário já existe no portal_users:', existingPortalUser.id);
      portalUserId = existingPortalUser.id;
      empresaId = existingPortalUser.empresa_id;
    } else {
      // Buscar empresa padrão
      console.log('🏢 Buscando empresa padrão...');
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id')
        .limit(1)
        .single();
      
      if (!empresa) {
        throw new Error('Nenhuma empresa encontrada no sistema');
      }
      
      empresaId = empresa.id;
      console.log('✅ Empresa encontrada:', empresaId);
      
      // Criar no portal_users
      console.log('👤 Criando usuário no portal_users...');
      const { data: newPortalUser, error: portalError } = await supabase
        .from('portal_users')
        .insert({
          email: email,
          nome: nome,
          empresa_id: empresaId,
          role: 'admin',
          can_create_vistorias: true,
          can_edit_vistorias: true,
          can_view_all_company_data: true,
          ativo: true
        })
        .select()
        .single();
      
      if (portalError) {
        throw new Error(`Erro ao criar portal_users: ${portalError.message}`);
      }
      
      portalUserId = newPortalUser.id;
      console.log('✅ Usuário criado no portal_users:', portalUserId);
    }
    
    // 2. Tentar criar usuário no Supabase Auth usando Admin API
    console.log('🔐 Criando usuário no Supabase Auth...');
    
    // Primeiro, verificar se o usuário já existe
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.log('⚠️ Erro ao listar usuários:', listError.message);
    }
    
    const existingUser = existingUsers?.users?.find(user => user.email === email);
    let authUserId;
    
    if (existingUser) {
      console.log('✅ Usuário já existe no Supabase Auth:', existingUser.id);
      authUserId = existingUser.id;
    } else {
      // Criar novo usuário
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          nome: nome
        }
      });
      
      if (createError) {
        console.log('⚠️ Erro ao criar usuário no Auth:', createError.message);
        
        // Se falhar, tentar com invite
        console.log('🔄 Tentando convidar usuário...');
        const { data: inviteUser, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
          data: {
            nome: nome
          }
        });
        
        if (inviteError) {
          console.log('⚠️ Erro ao convidar usuário:', inviteError.message);
          console.log('📝 Usuário existe no portal_users mas não foi possível criar no Auth.');
          console.log('💡 Tente criar manualmente no painel do Supabase ou use o email de convite.');
        } else {
          authUserId = inviteUser.user?.id;
          console.log('✅ Convite enviado! User ID:', authUserId);
        }
      } else {
        authUserId = newUser.user?.id;
        console.log('✅ Usuário criado no Supabase Auth:', authUserId);
      }
    }
    
    // 3. Atualizar portal_users com auth_user_id se disponível
    if (authUserId) {
      console.log('🔗 Vinculando auth_user_id ao portal_users...');
      const { error: updateError } = await supabase
        .from('portal_users')
        .update({ auth_user_id: authUserId })
        .eq('id', portalUserId);
      
      if (updateError) {
        console.log('⚠️ Aviso: Erro ao vincular auth_user_id:', updateError.message);
      } else {
        console.log('✅ Vinculação realizada com sucesso!');
      }
    }
    
    // 4. Verificação final
    console.log('🔍 Verificação final...');
    const { data: finalUser } = await supabase
      .from('portal_users')
      .select(`
        *,
        empresas(nome)
      `)
      .eq('email', email)
      .single();
    
    console.log('\n🎉 PROCESSO CONCLUÍDO!');
    console.log('📧 Email:', email);
    console.log('🔑 Senha:', password);
    console.log('👤 Nome:', finalUser.nome);
    console.log('🏢 Empresa:', finalUser.empresas?.nome || 'N/A');
    console.log('🛡️ Role:', finalUser.role);
    console.log('🆔 Portal User ID:', finalUser.id);
    console.log('🔐 Auth User ID:', finalUser.auth_user_id || 'Não vinculado');
    
    if (finalUser.auth_user_id) {
      console.log('\n✅ SUCESSO TOTAL! O usuário está pronto para fazer login no sistema!');
    } else {
      console.log('\n⚠️ PARCIALMENTE CRIADO: Usuário existe no sistema interno, mas pode precisar de configuração manual no Supabase Auth.');
      console.log('💡 Tente fazer login com as credenciais acima ou verifique o painel do Supabase.');
    }
    
  } catch (error) {
    console.error('❌ Erro ao criar super admin:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Executar
createSuperAdminComplete();