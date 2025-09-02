const https = require('https');

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js Test Client',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.IC-I9QsH2t5o60v70TmzVFmfe8rUuFdMD5kMErQ4CPI',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
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

async function testSupabaseDirect() {
  console.log('=== Teste Direto no Supabase ===\n');
  
  try {
    // Teste 1: Verificar se existe edge function de auth
    console.log('1. Testando edge function auth/login...');
    const loginData = {
      email: 'paranhoscontato.n@gmail.com',
      password: 'admin123'
    };
    
    const authResponse = await makeRequest('https://fsvwifbvehdhlufauahj.supabase.co/functions/v1/auth/login', {
      method: 'POST',
      body: loginData
    });
    
    console.log(`Status: ${authResponse.status}`);
    console.log(`Response:`, authResponse.data);
    
    // Teste 2: Verificar se existe edge function de portal login
    console.log('\n2. Testando edge function auth/portal/login...');
    const portalResponse = await makeRequest('https://fsvwifbvehdhlufauahj.supabase.co/functions/v1/auth/portal/login', {
      method: 'POST',
      body: loginData
    });
    
    console.log(`Status: ${portalResponse.status}`);
    console.log(`Response:`, portalResponse.data);
    
    // Teste 3: Verificar tabela portal_users diretamente
    console.log('\n3. Testando acesso direto à tabela portal_users...');
    const tableResponse = await makeRequest('https://fsvwifbvehdhlufauahj.supabase.co/rest/v1/portal_users?email=eq.paranhoscontato.n@gmail.com', {
      method: 'GET'
    });
    
    console.log(`Status: ${tableResponse.status}`);
    console.log(`Response:`, tableResponse.data);
    
  } catch (error) {
    console.error('Erro durante os testes:', error.message);
  }
}

// Executar os testes
testSupabaseDirect();