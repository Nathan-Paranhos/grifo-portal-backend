const https = require('https');
const http = require('http');

// Configurações
const API_BASE_URL = 'https://grifo-api.onrender.com';
const CREDENTIALS = {
  email: 'paranhoscontato.n@gmail.com',
  password: '23362336@Np10'
};

let authToken = null;

// Função para fazer requisições HTTP/HTTPS
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const requestOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = client.request(url, requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// Teste de saúde da API
async function testApiHealth() {
  console.log('\n=== TESTE DE SAÚDE DA API ===');
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/health`);
    console.log('✅ API Status:', response.status);
    console.log('📊 Health Data:', JSON.stringify(response.data, null, 2));
    return response.status === 200;
  } catch (error) {
    console.log('❌ Erro na API:', error.message);
    return false;
  }
}

// Teste de login do portal
async function testPortalLogin() {
  console.log('\n=== TESTE DE LOGIN DO PORTAL ===');
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/v1/auth/portal/login`, {
      method: 'POST',
      body: CREDENTIALS
    });
    
    console.log('📡 Status:', response.status);
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Login realizado com sucesso!');
      console.log('🔑 Token obtido:', authToken.substring(0, 20) + '...');
      return true;
    } else {
      console.log('❌ Falha no login');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro no login:', error.message);
    return false;
  }
}

// Teste de endpoints protegidos
async function testProtectedEndpoints() {
  console.log('\n=== TESTE DE ENDPOINTS PROTEGIDOS ===');
  
  if (!authToken) {
    console.log('❌ Token não disponível');
    return false;
  }

  const endpoints = [
    '/api/v1/dashboard/stats',
    '/api/v1/properties',
    '/api/v1/inspections',
    '/api/v1/users/profile'
  ];

  let successCount = 0;
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔍 Testando: ${endpoint}`);
      const response = await makeRequest(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      console.log(`📡 Status: ${response.status}`);
      
      if (response.status === 200) {
        console.log('✅ Endpoint funcionando');
        successCount++;
      } else if (response.status === 401) {
        console.log('🔒 Não autorizado (esperado se não houver dados)');
      } else {
        console.log('⚠️ Status inesperado:', response.data);
      }
    } catch (error) {
      console.log('❌ Erro:', error.message);
    }
  }
  
  console.log(`\n📊 Endpoints testados: ${successCount}/${endpoints.length}`);
  return successCount > 0;
}

// Teste de documentação da API
async function testApiDocs() {
  console.log('\n=== TESTE DE DOCUMENTAÇÃO ===');
  try {
    const response = await makeRequest(`${API_BASE_URL}/api/docs`);
    console.log('📡 Status:', response.status);
    
    if (response.status === 200) {
      console.log('✅ Documentação acessível');
      return true;
    } else {
      console.log('❌ Documentação não acessível');
      return false;
    }
  } catch (error) {
    console.log('❌ Erro na documentação:', error.message);
    return false;
  }
}

// Função principal
async function runTests() {
  console.log('🚀 INICIANDO TESTES DA API DE PRODUÇÃO');
  console.log('🌐 API Base URL:', API_BASE_URL);
  console.log('👤 Email:', CREDENTIALS.email);
  
  const results = {
    health: await testApiHealth(),
    login: await testPortalLogin(),
    protected: await testProtectedEndpoints(),
    docs: await testApiDocs()
  };
  
  console.log('\n=== RESUMO DOS TESTES ===');
  console.log('🏥 Saúde da API:', results.health ? '✅ OK' : '❌ FALHA');
  console.log('🔐 Login:', results.login ? '✅ OK' : '❌ FALHA');
  console.log('🛡️ Endpoints Protegidos:', results.protected ? '✅ OK' : '❌ FALHA');
  console.log('📚 Documentação:', results.docs ? '✅ OK' : '❌ FALHA');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  
  console.log(`\n📊 RESULTADO FINAL: ${passedTests}/${totalTests} testes passaram`);
  
  if (passedTests === totalTests) {
    console.log('🎉 TODOS OS TESTES PASSARAM! API está funcionando corretamente.');
  } else {
    console.log('⚠️ ALGUNS TESTES FALHARAM. Verifique os logs acima.');
  }
}

// Executar testes
runTests().catch(console.error);