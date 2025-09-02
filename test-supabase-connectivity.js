const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './api/.env' });

// Configurações do Supabase do arquivo api/.env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('=== TESTE DE CONECTIVIDADE COM SUPABASE ===');
console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? 'Configurada' : 'NÃO CONFIGURADA');
console.log('Anon Key:', supabaseAnonKey ? 'Configurada' : 'NÃO CONFIGURADA');
console.log('\n');

async function testSupabaseConnectivity() {
  try {
    // Teste 1: Conectividade básica com service role
    console.log('1. Testando conectividade com SERVICE ROLE...');
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: healthCheck, error: healthError } = await supabaseService
      .from('portal_users')
      .select('count', { count: 'exact', head: true });
    
    if (healthError) {
      console.error('❌ Erro na conectividade com SERVICE ROLE:', healthError.message);
    } else {
      console.log('✅ Conectividade com SERVICE ROLE: OK');
      console.log('   Total de registros em portal_users:', healthCheck?.count || 'N/A');
    }

    // Teste 2: Verificar se o usuário específico existe
    console.log('\n2. Verificando se o usuário existe...');
    const { data: userData, error: userError } = await supabaseService
      .from('portal_users')
      .select('*')
      .eq('email', 'paranhoscontato.n@gmail.com')
      .single();
    
    if (userError) {
      if (userError.code === 'PGRST116') {
        console.log('❌ Usuário NÃO ENCONTRADO na tabela portal_users');
      } else {
        console.error('❌ Erro ao buscar usuário:', userError.message);
      }
    } else {
      console.log('✅ Usuário ENCONTRADO:');
      console.log('   ID:', userData.id);
      console.log('   Nome:', userData.nome);
      console.log('   Email:', userData.email);
      console.log('   Ativo:', userData.ativo);
      console.log('   Auth User ID:', userData.auth_user_id);
      console.log('   First Login Completed:', userData.first_login_completed);
    }

    // Teste 3: Verificar usuário na tabela auth.users
    console.log('\n3. Verificando usuário na tabela auth.users...');
    const { data: authUserData, error: authUserError } = await supabaseService
      .from('users')
      .select('*')
      .eq('email', 'paranhoscontato.n@gmail.com')
      .single();
    
    if (authUserError) {
      if (authUserError.code === 'PGRST116') {
        console.log('❌ Usuário NÃO ENCONTRADO na tabela auth.users');
      } else {
        console.error('❌ Erro ao buscar usuário em auth.users:', authUserError.message);
      }
    } else {
      console.log('✅ Usuário ENCONTRADO em auth.users:');
      console.log('   ID:', authUserData.id);
      console.log('   Email:', authUserData.email);
      console.log('   Email Confirmed:', authUserData.email_confirmed_at ? 'Sim' : 'Não');
      console.log('   Last Sign In:', authUserData.last_sign_in_at);
    }

    // Teste 4: Teste de performance - medir tempo de resposta (sem JOIN)
    console.log('\n4. Testando performance da consulta...');
    const startTime = Date.now();
    
    // Primeira consulta: buscar dados do usuário
    const { data: perfData, error: perfError } = await supabaseService
      .from('portal_users')
      .select('id, email, nome, empresa_id, role, ativo')
      .eq('email', 'paranhoscontato.n@gmail.com')
      .single();
    
    let empresaData = null;
    let empresaError = null;
    
    // Segunda consulta: buscar dados da empresa se empresa_id existir
    if (perfData && perfData.empresa_id) {
      const { data: empresa, error: empError } = await supabaseService
        .from('empresas')
        .select('id, nome')
        .eq('id', perfData.empresa_id)
        .single();
      
      empresaData = empresa;
      empresaError = empError;
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log(`   Tempo de resposta da consulta (sem JOIN): ${responseTime}ms`);
    
    if (perfError) {
      console.error('❌ Erro na consulta do usuário:', perfError.message);
    } else if (empresaError) {
      console.error('❌ Erro na consulta da empresa:', empresaError.message);
    } else {
      console.log('✅ Consultas executadas com sucesso');
      if (empresaData) {
        console.log('   Empresa:', empresaData.nome);
      }
    }

    // Teste 5: Testando consultas separadas (evitando problemas de JOIN)
    console.log('\n5. Testando performance de consultas separadas...');
    const separateStart = Date.now();
    try {
      // Primeira consulta: buscar dados do usuário
      const { data: userData, error: userError } = await supabaseService
        .from('portal_users')
        .select('id, email, empresa_id')
        .eq('email', 'paranhoscontato.n@gmail.com')
        .single();
      
      if (userError) {
        console.log(`❌ Consulta do usuário falhou: ${userError.message}`);
        return;
      }
      
      // Segunda consulta: buscar dados da empresa se o usuário tiver empresa_id
      let companyData = null;
      if (userData.empresa_id) {
        const { data: company, error: companyError } = await supabaseService
          .from('empresas')
          .select('id, nome')
          .eq('id', userData.empresa_id)
          .single();
        
        if (companyError) {
          console.log(`❌ Consulta da empresa falhou: ${companyError.message}`);
        } else {
          companyData = company;
        }
      }
      
      const separateTime = Date.now() - separateStart;
      console.log(`✅ Consultas separadas executadas com sucesso em ${separateTime}ms`);
      console.log('Dados do usuário:', JSON.stringify(userData, null, 2));
      console.log('Dados da empresa:', JSON.stringify(companyData, null, 2));
      
    } catch (error) {
      console.log(`❌ Erro nas consultas separadas: ${error.message}`);
    }

    // Teste 6: Conectividade com ANON KEY
    console.log('\n6. Testando conectividade com ANON KEY...');
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('portal_users')
      .select('count', { count: 'exact', head: true });
    
    if (anonError) {
      console.error('❌ Erro na conectividade com ANON KEY:', anonError.message);
    } else {
      console.log('✅ Conectividade com ANON KEY: OK');
    }

  } catch (error) {
    console.error('❌ Erro geral no teste:', error.message);
  }
}

// Executar os testes
testSupabaseConnectivity().then(() => {
  console.log('\n=== TESTE CONCLUÍDO ===');
}).catch(error => {
  console.error('❌ Erro fatal:', error.message);
});