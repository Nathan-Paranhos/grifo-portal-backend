const https = require('https');
const http = require('http');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js Test Client',
        ...options.headers
      }
    };

    const req = protocol.request(requestOptions, (res) => {
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

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testProductionLogin() {
  console.log('=== Teste de Login na API de Produção (Supabase Edge Functions) ===\n');
  
  try {
    // Teste 1: Health check
    console.log('1. Testando health check...');
    const healthResponse = await makeRequest('https://grifo-api-backend.onrender.com/health');
    console.log(`Status: ${healthResponse.status}`);
    console.log(`Response:`, healthResponse.data);
    console.log('');
    
    // Teste 2: Login com endpoint /functions/v1/auth/login
    console.log('2. Testando login com /functions/v1/auth/login...');
    const loginData = {
      email: 'paranhoscontato.n@gmail.com',
      password: 'admin123'
    };
    
    const loginResponse = await makeRequest('https://grifo-api-backend.onrender.com/functions/v1/auth/login', {
      method: 'POST',
      body: loginData
    });
    
    console.log(`Status: ${loginResponse.status}`);
    console.log(`Response:`, loginResponse.data);
    
    if (loginResponse.status === 200 && loginResponse.data.access_token) {
      console.log('\n✅ Login realizado com sucesso!');
      console.log(`Token: ${loginResponse.data.access_token.substring(0, 20)}...`);
      
      // Teste 3: Endpoint protegido
      console.log('\n3. Testando endpoint protegido...');
      const protectedResponse = await makeRequest('https://grifo-api-backend.onrender.com/functions/v1/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.data.access_token}`
        }
      });
      
      console.log(`Status: ${protectedResponse.status}`);
      console.log(`Response:`, protectedResponse.data);
    } else {
      console.log('\n❌ Falha no login');
    }
    
    // Teste 3: Tentar login portal
    console.log('\n4. Testando login portal com /functions/v1/auth/portal/login...');
    const portalLoginResponse = await makeRequest('https://grifo-api-backend.onrender.com/functions/v1/auth/portal/login', {
      method: 'POST',
      body: loginData
    });
    
    console.log(`Status: ${portalLoginResponse.status}`);
    console.log(`Response:`, portalLoginResponse.data);
    
    if (portalLoginResponse.status === 200 && portalLoginResponse.data.access_token) {
      console.log('\n✅ Login portal realizado com sucesso!');
      console.log(`Token: ${portalLoginResponse.data.access_token.substring(0, 20)}...`);
    }
    
  } catch (error) {
    console.error('Erro durante os testes:', error.message);
  }
}

// Executar os testes
testProductionLogin();