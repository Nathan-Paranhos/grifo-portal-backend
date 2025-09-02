const { createClient } = require('@supabase/supabase-js');
const https = require('https');

// Configuração do Supabase
const supabaseUrl = 'https://fsvwifbvehdhlufauahj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Credenciais de teste
const TEST_EMAIL = 'paranhoscontato.n@gmail.com';
const TEST_PASSWORD = 'admin123';

async function testPortalFunctionality() {
  console.log('=== TESTE DE FUNCIONALIDADE DO PORTAL ===\n');
  
  try {
    // Teste 1: Verificar conectividade com Supabase
    console.log('1. Testando conectividade com Supabase...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('portal_users')
      .select('count')
      .limit(1);
    
    if (healthError) {
      console.log('❌ Erro de conectividade:', healthError.message);
    } else {
      console.log('✅ Conectividade com Supabase OK');
    }
    
    // Teste 2: Verificar se usuário existe na tabela portal_users
    console.log('\n2. Verificando usuário na tabela portal_users...');
    const { data: userData, error: userError } = await supabase
      .from('portal_users')
      .select('*')
      .eq('email', TEST_EMAIL)
      .single();
    
    if (userError) {
      console.log('❌ Usuário não encontrado:', userError.message);
    } else {
      console.log('✅ Usuário encontrado:');
      console.log(`   - ID: ${userData.id}`);
      console.log(`   - Email: ${userData.email}`);
      console.log(`   - Nome: ${userData.nome}`);
      console.log(`   - Ativo: ${userData.ativo}`);
    }
    
    // Teste 3: Tentar login com Supabase Auth
    console.log('\n3. Testando login com Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });
    
    if (authError) {
      console.log('❌ Erro no login:', authError.message);
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log(`   - User ID: ${authData.user?.id}`);
      console.log(`   - Email: ${authData.user?.email}`);
      console.log(`   - Token: ${authData.session?.access_token ? 'Presente' : 'Ausente'}`);
      
      // Teste 4: Verificar acesso a outras tabelas
      console.log('\n4. Testando acesso às tabelas principais...');
      
      const tables = ['clientes', 'imoveis', 'solicitacoes_vistoria', 'vistorias'];
      
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('count')
            .limit(1);
          
          if (error) {
            console.log(`   ❌ ${table}: ${error.message}`);
          } else {
            console.log(`   ✅ ${table}: Acesso OK`);
          }
        } catch (err) {
          console.log(`   ❌ ${table}: ${err.message}`);
        }
      }
      
      // Logout
      await supabase.auth.signOut();
      console.log('\n✅ Logout realizado');
    }
    
  } catch (error) {
    console.error('❌ Erro geral durante os testes:', error.message);
  }
}

// Executar os testes
testPortalFunctionality();