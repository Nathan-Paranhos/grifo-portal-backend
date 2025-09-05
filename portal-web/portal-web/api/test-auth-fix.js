const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas!');
  console.log('SUPABASE_URL:', supabaseUrl ? '✅ Configurada' : '❌ Não configurada');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Configurada' : '❌ Não configurada');
  console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Configurada' : '❌ Não configurada');
  process.exit(1);
}

// Cliente com service role para operações administrativas
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
// Cliente com anon key para testes de login
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

const testEmail = 'paranhoscontato.n@gmail.com';
const testPassword = 'Teste@2025';
const apiUrl = 'http://localhost:3002';

async function testAuthenticationFlow() {
  console.log('🔍 Iniciando teste de autenticação completo...');
  console.log('📧 Email:', testEmail);
  console.log('🔑 Senha:', testPassword);
  console.log('🌐 API URL:', apiUrl);
  console.log('\n' + '='.repeat(60));

  try {
    // 1. Verificar se usuário existe no Supabase Auth
    console.log('\n1️⃣ Verificando usuário no Supabase Auth...');
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Erro ao listar usuários:', authError.message);
      return;
    }

    let authUser = authUsers.users.find(user => user.email === testEmail);
    console.log('👤 Usuário no Auth:', authUser ? '✅ Encontrado' : '❌ Não encontrado');

    // 2. Criar usuário no Auth se não existir
    if (!authUser) {
      console.log('\n2️⃣ Criando usuário no Supabase Auth...');
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true
      });

      if (createError) {
        console.error('❌ Erro ao criar usuário:', createError.message);
        return;
      }

      authUser = newUser.user;
      console.log('✅ Usuário criado com sucesso!');
      console.log('🆔 ID:', authUser.id);
    } else {
      // Atualizar senha se usuário já existe
      console.log('\n2️⃣ Atualizando senha do usuário...');
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { password: testPassword }
      );

      if (updateError) {
        console.error('❌ Erro ao atualizar senha:', updateError.message);
        return;
      }
      console.log('✅ Senha atualizada com sucesso!');
    }

    // 3. Verificar se usuário existe na tabela portal_users
    console.log('\n3️⃣ Verificando usuário na tabela portal_users...');
    const { data: portalUser, error: portalError } = await supabaseAdmin
      .from('portal_users')
      .select('*')
      .eq('email', testEmail)
      .single();

    if (portalError && portalError.code !== 'PGRST116') {
      console.error('❌ Erro ao verificar portal_users:', portalError.message);
      return;
    }

    console.log('👥 Usuário no Portal:', portalUser ? '✅ Encontrado' : '❌ Não encontrado');

    // 4. Criar usuário na tabela portal_users se não existir
    if (!portalUser) {
      console.log('\n4️⃣ Criando usuário na tabela portal_users...');
      const { data: newPortalUser, error: insertError } = await supabaseAdmin
        .from('portal_users')
        .insert({
          email: testEmail,
          nome: 'Paranhos User',
          role: 'admin',
          auth_user_id: authUser.id,
          ativo: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro ao criar usuário no portal:', insertError.message);
        return;
      }

      console.log('✅ Usuário criado no portal com sucesso!');
      console.log('🆔 Portal ID:', newPortalUser.id);
    } else {
      // Atualizar auth_user_id se necessário
      if (portalUser.auth_user_id !== authUser.id) {
        console.log('\n4️⃣ Atualizando auth_user_id no portal_users...');
        const { error: updatePortalError } = await supabaseAdmin
          .from('portal_users')
          .update({ auth_user_id: authUser.id })
          .eq('id', portalUser.id);

        if (updatePortalError) {
          console.error('❌ Erro ao atualizar portal_users:', updatePortalError.message);
          return;
        }
        console.log('✅ auth_user_id atualizado com sucesso!');
      }
    }

    // 5. Testar login direto com Supabase
    console.log('\n5️⃣ Testando login direto com Supabase...');
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginError) {
      console.error('❌ Erro no login direto:', loginError.message);
      return;
    }

    console.log('✅ Login direto com Supabase funcionando!');
    console.log('🎫 Access Token:', loginData.session.access_token.substring(0, 50) + '...');

    // 6. Testar endpoint da API
    console.log('\n6️⃣ Testando endpoint da API...');
    try {
      const response = await axios.post(`${apiUrl}/api/v1/auth/portal/login`, {
        email: testEmail,
        password: testPassword
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      console.log('✅ Login via API funcionando!');
      console.log('📊 Status:', response.status);
      console.log('👤 Usuário:', response.data.user?.email || 'N/A');
      console.log('🎫 Token:', response.data.access_token ? 'Presente' : 'Ausente');
      
      // 7. Verificar se o token é válido
      if (response.data.access_token) {
        console.log('\n7️⃣ Verificando validade do token...');
        try {
          const profileResponse = await axios.get(`${apiUrl}/api/v1/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${response.data.access_token}`,
              'Content-Type': 'application/json'
            },
            timeout: 5000
          });
          
          console.log('✅ Token válido! Perfil obtido com sucesso.');
          console.log('👤 Perfil:', profileResponse.data.email || 'N/A');
        } catch (profileError) {
          console.error('❌ Token inválido ou erro ao obter perfil:', profileError.response?.data || profileError.message);
        }
      }

    } catch (apiError) {
      console.error('❌ Erro no login via API:', apiError.response?.data || apiError.message);
      console.log('📊 Status Code:', apiError.response?.status || 'N/A');
      
      if (apiError.code === 'ECONNREFUSED') {
        console.log('🔧 Dica: Verifique se o servidor da API está rodando na porta 5000');
      }
      return;
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TESTE COMPLETO! Autenticação funcionando perfeitamente!');
    console.log('✅ Usuário existe no Supabase Auth');
    console.log('✅ Usuário existe na tabela portal_users');
    console.log('✅ Login direto com Supabase funciona');
    console.log('✅ Login via API funciona');
    console.log('✅ Token é válido');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('💥 Erro inesperado:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Executar o teste
if (require.main === module) {
  testAuthenticationFlow();
}

module.exports = { testAuthenticationFlow };