// Teste de Login para Produção
// Este script testa se o login está funcionando com as configurações de produção

const https = require('https');
const http = require('http');

// Configurações
const API_BASE_URL = 'https://grifo-api-backend.onrender.com';
const TEST_USER = {
  email: 'paranhoscontato.n@gmail.com',
  password: 'Teste@2025'
};

// Função para fazer requisições HTTP/HTTPS
function makeRequest(url, options, data) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    
    const req = lib.request(url, options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Teste de conectividade com a API
async function testApiConnectivity() {
  console.log('🔍 Testando conectividade com a API...');
  
  try {
    const response = await makeRequest(API_BASE_URL, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ API está respondendo:');
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Resposta: ${JSON.stringify(response.body, null, 2)}`);
    return true;
  } catch (error) {
    console.log('❌ Erro ao conectar com a API:');
    console.log(`   ${error.message}`);
    return false;
  }
}

// Teste de login
async function testLogin() {
  console.log('\n🔐 Testando login do usuário super admin...');
  
  const loginData = JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password
  });
  
  try {
    // Tentar diferentes endpoints de login
    const endpoints = [
      '/api/v1/auth/login',
      '/functions/v1/auth/login',
      '/auth/login',
      '/login'
    ];
    
    for (const endpoint of endpoints) {
      console.log(`   Testando endpoint: ${endpoint}`);
      
      try {
        const response = await makeRequest(`${API_BASE_URL}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }, loginData);
        
        console.log(`   Status: ${response.statusCode}`);
        
        if (response.statusCode === 200 || response.statusCode === 201) {
          console.log('✅ Login realizado com sucesso!');
          console.log(`   Resposta: ${JSON.stringify(response.body, null, 2)}`);
          return true;
        } else if (response.statusCode !== 404) {
          console.log(`   Resposta: ${JSON.stringify(response.body, null, 2)}`);
        }
      } catch (error) {
        console.log(`   Erro: ${error.message}`);
      }
    }
    
    console.log('❌ Nenhum endpoint de login funcionou');
    return false;
  } catch (error) {
    console.log('❌ Erro durante o teste de login:');
    console.log(`   ${error.message}`);
    return false;
  }
}

// Teste das variáveis de ambiente do frontend
function testEnvironmentVariables() {
  console.log('\n🔧 Verificando variáveis de ambiente...');
  
  const envVars = {
    'NEXT_PUBLIC_GRIFO_API_URL': process.env.NEXT_PUBLIC_GRIFO_API_URL,
    'NEXT_PUBLIC_API_URL': process.env.NEXT_PUBLIC_API_URL,
    'NEXT_PUBLIC_GRIFO_API_BASE_URL': process.env.NEXT_PUBLIC_GRIFO_API_BASE_URL,
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***configurada***' : undefined,
    'NODE_ENV': process.env.NODE_ENV
  };
  
  console.log('   Variáveis de ambiente:');
  Object.entries(envVars).forEach(([key, value]) => {
    const status = value ? '✅' : '❌';
    console.log(`   ${status} ${key}: ${value || 'não configurada'}`);
  });
}

// Executar todos os testes
async function runTests() {
  console.log('🚀 Iniciando testes de produção do Portal Grifo\n');
  
  testEnvironmentVariables();
  
  const apiConnected = await testApiConnectivity();
  
  if (apiConnected) {
    await testLogin();
  }
  
  console.log('\n📋 Resumo dos testes:');
  console.log('   - Variáveis de ambiente: verificadas');
  console.log(`   - Conectividade da API: ${apiConnected ? '✅' : '❌'}`);
  console.log('   - Funcionalidade de login: testada');
  
  console.log('\n💡 Próximos passos:');
  console.log('   1. Verificar se o usuário super admin existe no Supabase');
  console.log('   2. Testar login manual no portal web');
  console.log('   3. Verificar logs da API no Render');
  console.log('   4. Testar operações CRUD no dashboard');
}

// Executar os testes
runTests().catch(console.error);