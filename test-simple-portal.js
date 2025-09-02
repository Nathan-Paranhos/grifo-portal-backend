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
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
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

async function testSimplePortal() {
  console.log('=== TESTE SIMPLES DO PORTAL ===\n');
  
  try {
    // Teste 1: Verificar tabela portal_users
    console.log('1. Verificando tabela portal_users...');
    const usersResponse = await makeRequest('https://fsvwifbvehdhlufauahj.supabase.co/rest/v1/portal_users?email=eq.paranhoscontato.n@gmail.com');
    console.log(`Status: ${usersResponse.status}`);
    console.log('Dados:', usersResponse.data);
    
    // Teste 2: Verificar tabela clientes
    console.log('\n2. Verificando tabela clientes...');
    const clientesResponse = await makeRequest('https://fsvwifbvehdhlufauahj.supabase.co/rest/v1/clientes?limit=1');
    console.log(`Status: ${clientesResponse.status}`);
    console.log('Dados:', clientesResponse.data);
    
    // Teste 3: Verificar portal rodando
    console.log('\n3. Verificando se portal está rodando...');
    try {
      const portalResponse = await makeRequest('http://localhost:3000');
      console.log(`Portal Status: ${portalResponse.status}`);
    } catch (error) {
      console.log('Portal não está acessível:', error.message);
    }
    
  } catch (error) {
    console.error('Erro durante os testes:', error.message);
  }
}

// Executar os testes
testSimplePortal();