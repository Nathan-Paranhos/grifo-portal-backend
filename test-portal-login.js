const https = require('https');
const http = require('http');

// Configurações
const API_BASE_URL = 'https://grifo-api-backend.onrender.com';
const TEST_EMAIL = 'paranhoscontato.n@gmail.com';
const TEST_PASSWORD = 'admin123'; // Senha padrão para super admin

// Função para fazer requisições HTTP/HTTPS
function makeRequest(url, options, data = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(requestOptions, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Função para testar conectividade
async function testConnectivity() {
  console.log('\n=== TESTE DE CONECTIVIDADE ===');
  try {
    const response = await makeRequest(API_BASE_URL, { method: 'GET' });
    console.log(`✅ API Base URL: ${response.statusCode} - ${response.data?.message || 'OK'}`);
    return true;
  } catch (error) {
    console.log(`❌ Erro de conectividade: ${error.message}`);
    return false;
  }
}

// Função para testar login
async function testLogin() {
  console.log('\n=== TESTE DE LOGIN ===');
  
  const loginData = {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  try {
    // Testar endpoint do portal
    console.log('Testando endpoint: /api/v1/auth/portal/login');
    const response = await makeRequest(
      `${API_BASE_URL}/api/v1/auth/portal/login`,
      options,
      JSON.stringify(loginData)
    );
    
    console.log(`Status: ${response.statusCode}`);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    
    if (response.statusCode === 200 && response.data.success) {
      console.log('✅ Login realizado com sucesso!');
      console.log('Token:', response.data.data?.access_token ? 'Recebido' : 'Não recebido');
      console.log('Usuário:', response.data.data?.user?.email || 'Não identificado');
      return response.data.data;
    } else {
      console.log('❌ Falha no login:', response.data.message || response.data.error || 'Erro desconhecido');
      return null;
    }
  } catch (error) {
    console.log(`❌ Erro na requisição de login: ${error.message}`);
    return null;
  }
}

// Função para testar endpoint protegido
async function testProtectedEndpoint(token) {
  if (!token) {
    console.log('\n❌ Não é possível testar endpoint protegido sem token');
    return;
  }
  
  console.log('\n=== TESTE DE ENDPOINT PROTEGIDO ===');
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
  
  try {
    const response = await makeRequest(
      `${API_BASE_URL}/api/v1/auth/me`,
      options
    );
    
    console.log(`Status: ${response.statusCode}`);
    console.log('Resposta:', JSON.stringify(response.data, null, 2));
    
    if (response.statusCode === 200) {
      console.log('✅ Endpoint protegido funcionando!');
    } else {
      console.log('❌ Falha no endpoint protegido');
    }
  } catch (error) {
    console.log(`❌ Erro no endpoint protegido: ${error.message}`);
  }
}

// Função principal
async function main() {
  console.log('🚀 INICIANDO TESTES DO PORTAL GRIFO');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Email de teste: ${TEST_EMAIL}`);
  
  // Teste de conectividade
  const isConnected = await testConnectivity();
  if (!isConnected) {
    console.log('\n❌ Não foi possível conectar à API. Encerrando testes.');
    return;
  }
  
  // Teste de login
  const loginResult = await testLogin();
  
  // Teste de endpoint protegido
  if (loginResult?.access_token) {
    await testProtectedEndpoint(loginResult.access_token);
  }
  
  console.log('\n🏁 TESTES CONCLUÍDOS');
}

// Executar testes
main().catch(console.error);