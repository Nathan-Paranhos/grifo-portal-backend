const https = require('https');
const http = require('http');

// Função para fazer requisições HTTP/HTTPS
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js Test Client',
        ...options.headers
      }
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

// Função para testar conectividade
async function testConnectivity(baseUrl) {
  console.log('\n=== TESTE DE CONECTIVIDADE ===');
  try {
    const response = await makeRequest(`${baseUrl}/api/v1/health`, { method: 'GET' });
    console.log(`✅ Conectividade: ${response.status} - API respondendo`);
    if (response.data) {
      console.log('Resposta:', JSON.stringify(response.data, null, 2));
    }
    return true;
  } catch (error) {
    console.log(`❌ Erro de conectividade: ${error.message}`);
    return false;
  }
}

// Função para testar login do portal
async function testPortalLogin(baseUrl, email, password) {
  console.log('\n=== TESTE DE LOGIN DO PORTAL ===');
  try {
    const response = await makeRequest(`${baseUrl}/api/v1/auth/portal/login`, {
      method: 'POST',
      body: {
        email: email,
        password: password,
        remember: false
      }
    });
    
    console.log(`Status: ${response.status}`);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.success) {
      console.log('✅ Login realizado com sucesso!');
      return response.data.data.access_token;
    } else {
      console.log('❌ Falha no login');
      return null;
    }
  } catch (error) {
    console.log(`❌ Erro no login: ${error.message}`);
    return null;
  }
}

// Função para testar endpoint protegido
async function testProtectedEndpoint(baseUrl, token) {
  console.log('\n=== TESTE DE ENDPOINT PROTEGIDO ===');
  try {
    const response = await makeRequest(`${baseUrl}/api/v1/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`Status: ${response.status}`);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200) {
      console.log('✅ Endpoint protegido funcionando!');
    } else {
      console.log('❌ Falha no endpoint protegido');
    }
  } catch (error) {
    console.log(`❌ Erro no endpoint protegido: ${error.message}`);
  }
}

// Função principal
async function runTests() {
  console.log('🚀 INICIANDO TESTES DA API DE PRODUÇÃO');
  console.log('=====================================');
  
  const baseUrl = 'https://grifo-api-backend.onrender.com';
  const email = 'paranhoscontato.n@gmail.com';
  const password = 'admin123';
  
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  
  // Teste 1: Conectividade
  const isConnected = await testConnectivity(baseUrl);
  if (!isConnected) {
    console.log('\n❌ Não foi possível conectar à API. Encerrando testes.');
    return;
  }
  
  // Teste 2: Login do Portal
  const token = await testPortalLogin(baseUrl, email, password);
  if (!token) {
    console.log('\n❌ Login falhou. Encerrando testes.');
    return;
  }
  
  // Teste 3: Endpoint protegido
  await testProtectedEndpoint(baseUrl, token);
  
  console.log('\n=== RESUMO DOS TESTES ===');
  console.log('✅ Conectividade: OK');
  console.log(token ? '✅ Login: OK' : '❌ Login: FALHOU');
  console.log('✅ Testes concluídos');
}

// Executar os testes
runTests().catch(console.error);