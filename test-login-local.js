const axios = require('axios');

// Configurações do teste
const API_BASE_URL = 'http://localhost:3002';
const PORTAL_URL = 'http://localhost:3000';
const TEST_CREDENTIALS = {
  email: 'paranhoscontato.n@gmail.com',
  password: 'Teste@2025'
};

console.log('🚀 INICIANDO TESTE FÍSICO DO SISTEMA GRIFO LOCAL');
console.log('=' .repeat(60));
console.log(`Portal Web: ${PORTAL_URL}`);
console.log(`API: ${API_BASE_URL}`);
console.log(`Credenciais de teste: ${TEST_CREDENTIALS.email}`);
console.log('=' .repeat(60));

async function testLogin() {
  try {
    console.log('\n📋 TESTE 1: Verificando se a API está respondendo...');
    
    // Teste de health check da API
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/api/health`, {
        timeout: 5000
      });
      console.log('✅ API está online:', healthResponse.status);
    } catch (error) {
      console.log('❌ API não está respondendo:', error.message);
      return;
    }

    console.log('\n🔐 TESTE 2: Testando login no portal...');
    
    // Teste de login
    const loginResponse = await axios.post(`${API_BASE_URL}/api/v1/auth/portal/login`, {
      email: TEST_CREDENTIALS.email,
      password: TEST_CREDENTIALS.password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Teste-Local-Grifo/1.0'
      },
      timeout: 10000
    });

    console.log('✅ LOGIN BEM-SUCEDIDO!');
    console.log('Status:', loginResponse.status);
    console.log('Headers de resposta:', JSON.stringify(loginResponse.headers, null, 2));
    console.log('Dados da resposta:', JSON.stringify(loginResponse.data, null, 2));

    // Verificar se recebeu token
    const token = loginResponse.data?.access_token || loginResponse.data?.token;
    if (token) {
      console.log('✅ Token JWT recebido com sucesso');
      console.log('Token type:', loginResponse.data.access_token ? 'access_token' : 'token');
      
      // Teste de endpoint protegido
      console.log('\n🔒 TESTE 3: Testando endpoint protegido...');
      
      try {
        const protectedResponse = await axios.get(`${API_BASE_URL}/api/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        
        console.log('✅ Endpoint protegido funcionando!');
        console.log('Dados do usuário:', JSON.stringify(protectedResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Erro no endpoint protegido:', error.response?.data || error.message);
      }
    } else {
      console.log('⚠️  Token não encontrado na resposta');
    }

  } catch (error) {
    console.log('❌ ERRO NO LOGIN:');
    console.log('Status:', error.response?.status);
    console.log('Dados do erro:', JSON.stringify(error.response?.data, null, 2));
    console.log('Mensagem:', error.message);
    
    if (error.response?.status === 401) {
      console.log('\n🔍 DIAGNÓSTICO: Erro 401 - Credenciais inválidas');
      console.log('Possíveis causas:');
      console.log('- Senha incorreta');
      console.log('- Usuário não existe no Supabase Auth');
      console.log('- Problema na sincronização entre Supabase Auth e portal_users');
    }
  }
}

async function testPortalAccess() {
  console.log('\n🌐 TESTE 4: Verificando acesso ao portal web...');
  
  try {
    const portalResponse = await axios.get(PORTAL_URL, {
      timeout: 5000
    });
    console.log('✅ Portal web está acessível:', portalResponse.status);
  } catch (error) {
    console.log('❌ Portal web não está acessível:', error.message);
  }
}

async function runAllTests() {
  const startTime = new Date();
  console.log(`\n⏰ Iniciado em: ${startTime.toLocaleString()}`);
  
  await testPortalAccess();
  await testLogin();
  
  const endTime = new Date();
  const duration = endTime - startTime;
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 RESUMO DO TESTE');
  console.log('=' .repeat(60));
  console.log(`⏱️  Duração total: ${duration}ms`);
  console.log(`🕐 Finalizado em: ${endTime.toLocaleString()}`);
  console.log('\n✨ Teste físico completo finalizado!');
}

// Executar todos os testes
runAllTests().catch(console.error);