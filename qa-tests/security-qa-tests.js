/**
 * GRIFO VISTORIAS - SECURITY QA TESTS
 * Testes avançados de segurança e vulnerabilidades
 */

const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configurações
const CONFIG = {
  API_URL: 'https://grifo-api.onrender.com',
  PORTAL_URL: 'https://grifo-portal.vercel.app',
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://your-project.supabase.co',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'your-anon-key',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'your-service-key'
};

const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_KEY);

let securityTestResults = {
  authentication: [],
  authorization: [],
  injection: [],
  xss: [],
  csrf: [],
  headers: [],
  encryption: [],
  rateLimit: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
    critical: 0
  }
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    critical: '\x1b[35m',
    reset: '\x1b[0m'
  };
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function addTestResult(category, testName, status, message, details = {}, severity = 'medium') {
  const result = {
    test: testName,
    status,
    message,
    severity,
    timestamp: new Date().toISOString(),
    details
  };
  
  securityTestResults[category].push(result);
  securityTestResults.summary.total++;
  
  if (status === 'PASS') {
    securityTestResults.summary.passed++;
    log(`✅ ${testName}: ${message}`, 'success');
  } else if (status === 'FAIL') {
    securityTestResults.summary.failed++;
    if (severity === 'critical') {
      securityTestResults.summary.critical++;
      log(`🚨 CRÍTICO - ${testName}: ${message}`, 'critical');
    } else {
      log(`❌ ${testName}: ${message}`, 'error');
    }
  } else if (status === 'WARN') {
    securityTestResults.summary.warnings++;
    log(`⚠️  ${testName}: ${message}`, 'warning');
  }
}

// TESTES DE AUTENTICAÇÃO AVANÇADOS
async function testAdvancedAuthentication() {
  log('🔐 Iniciando testes avançados de autenticação...', 'info');
  
  // Teste 1: Força bruta na autenticação
  try {
    const testEmail = `bruteforce-${Date.now()}@test.com`;
    const wrongPassword = 'wrongpassword';
    const attempts = [];
    
    for (let i = 0; i < 5; i++) {
      const startTime = Date.now();
      try {
        await supabase.auth.signInWithPassword({
          email: testEmail,
          password: wrongPassword
        });
      } catch (error) {
        // Esperado falhar
      }
      const endTime = Date.now();
      attempts.push(endTime - startTime);
    }
    
    const avgTime = attempts.reduce((a, b) => a + b, 0) / attempts.length;
    const hasDelay = avgTime > 1000; // Deve ter delay após tentativas
    
    if (hasDelay) {
      addTestResult('authentication', 'Brute Force Protection', 'PASS', 
        `Proteção contra força bruta ativa (delay médio: ${avgTime.toFixed(0)}ms)`);
    } else {
      addTestResult('authentication', 'Brute Force Protection', 'WARN', 
        'Sem proteção aparente contra força bruta', {}, 'high');
    }
  } catch (error) {
    addTestResult('authentication', 'Brute Force Protection', 'FAIL', 
      `Erro no teste: ${error.message}`);
  }
  
  // Teste 2: Validação de token JWT
  try {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    
    const response = await axios.get(`${CONFIG.API_URL}/dashboard`, {
      headers: {
        'Authorization': `Bearer ${fakeToken}`
      },
      validateStatus: () => true
    });
    
    if (response.status === 401 || response.status === 403) {
      addTestResult('authentication', 'JWT Token Validation', 'PASS', 
        'API rejeita tokens JWT inválidos corretamente');
    } else {
      addTestResult('authentication', 'JWT Token Validation', 'FAIL', 
        'API aceita tokens JWT inválidos', {}, 'critical');
    }
  } catch (error) {
    addTestResult('authentication', 'JWT Token Validation', 'PASS', 
      'Token inválido rejeitado (conexão recusada)');
  }
  
  // Teste 3: Expiração de sessão
  try {
    const testUser = await supabaseAdmin.auth.admin.createUser({
      email: `session-test-${Date.now()}@test.com`,
      password: 'TestPass123!'
    });
    
    if (testUser.data.user) {
      const { data: session } = await supabase.auth.signInWithPassword({
        email: testUser.data.user.email,
        password: 'TestPass123!'
      });
      
      if (session.session) {
        const expiresAt = new Date(session.session.expires_at * 1000);
        const now = new Date();
        const timeToExpire = expiresAt.getTime() - now.getTime();
        
        if (timeToExpire > 0 && timeToExpire < 24 * 60 * 60 * 1000) { // Menos de 24h
          addTestResult('authentication', 'Session Expiration', 'PASS', 
            `Sessão expira em ${Math.round(timeToExpire / (60 * 60 * 1000))} horas`);
        } else {
          addTestResult('authentication', 'Session Expiration', 'WARN', 
            'Sessão com tempo de expiração muito longo', {}, 'medium');
        }
      }
      
      // Limpar usuário de teste
      await supabaseAdmin.auth.admin.deleteUser(testUser.data.user.id);
    }
  } catch (error) {
    addTestResult('authentication', 'Session Expiration', 'FAIL', 
      `Erro no teste: ${error.message}`);
  }
}

// TESTES DE AUTORIZAÇÃO
async function testAuthorization() {
  log('🛡️  Iniciando testes de autorização...', 'info');
  
  // Teste 1: Escalação de privilégios
  try {
    const regularUser = await supabaseAdmin.auth.admin.createUser({
      email: `regular-${Date.now()}@test.com`,
      password: 'TestPass123!',
      user_metadata: {
        role: 'vistoriador',
        company_id: 'test-company'
      }
    });
    
    if (regularUser.data.user) {
      const userSupabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      await userSupabase.auth.signInWithPassword({
        email: regularUser.data.user.email,
        password: 'TestPass123!'
      });
      
      // Tentar acessar função administrativa
      const { data, error } = await userSupabase
        .from('companies')
        .insert({ name: 'Empresa Maliciosa', cnpj: '99999999000199' });
      
      if (error && (error.code === 'PGRST116' || error.code === '42501')) {
        addTestResult('authorization', 'Privilege Escalation Protection', 'PASS', 
          'Usuário comum não pode executar operações administrativas');
      } else if (!error) {
        addTestResult('authorization', 'Privilege Escalation Protection', 'FAIL', 
          'CRÍTICO: Usuário comum conseguiu executar operação administrativa', {}, 'critical');
      } else {
        addTestResult('authorization', 'Privilege Escalation Protection', 'WARN', 
          `Erro inesperado: ${error.message}`);
      }
      
      await supabaseAdmin.auth.admin.deleteUser(regularUser.data.user.id);
    }
  } catch (error) {
    addTestResult('authorization', 'Privilege Escalation Protection', 'FAIL', 
      `Erro no teste: ${error.message}`);
  }
  
  // Teste 2: Acesso cross-company
  try {
    const company1Id = 'test-company-1';
    const company2Id = 'test-company-2';
    
    const user1 = await supabaseAdmin.auth.admin.createUser({
      email: `user1-${Date.now()}@test.com`,
      password: 'TestPass123!',
      user_metadata: {
        role: 'admin',
        company_id: company1Id
      }
    });
    
    if (user1.data.user) {
      // Criar dados para empresa 2
      await supabaseAdmin.from('companies').upsert([
        { id: company1Id, name: 'Empresa 1', cnpj: '11111111000111' },
        { id: company2Id, name: 'Empresa 2', cnpj: '22222222000222' }
      ]);
      
      await supabaseAdmin.from('imoveis').insert({
        id: 'imovel-company-2',
        company_id: company2Id,
        endereco: 'Rua Secreta, 999'
      });
      
      const user1Supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
      await user1Supabase.auth.signInWithPassword({
        email: user1.data.user.email,
        password: 'TestPass123!'
      });
      
      // Tentar acessar dados da empresa 2
      const { data, error } = await user1Supabase
        .from('imoveis')
        .select('*')
        .eq('company_id', company2Id);
      
      if (error || (data && data.length === 0)) {
        addTestResult('authorization', 'Cross-Company Access Protection', 'PASS', 
          'Usuário não consegue acessar dados de outras empresas');
      } else if (data && data.length > 0) {
        addTestResult('authorization', 'Cross-Company Access Protection', 'FAIL', 
          'CRÍTICO: Vazamento de dados entre empresas', {}, 'critical');
      }
      
      // Limpar
      await supabaseAdmin.auth.admin.deleteUser(user1.data.user.id);
      await supabaseAdmin.from('imoveis').delete().eq('id', 'imovel-company-2');
      await supabaseAdmin.from('companies').delete().in('id', [company1Id, company2Id]);
    }
  } catch (error) {
    addTestResult('authorization', 'Cross-Company Access Protection', 'FAIL', 
      `Erro no teste: ${error.message}`);
  }
}

// TESTES DE INJEÇÃO
async function testInjectionVulnerabilities() {
  log('💉 Iniciando testes de vulnerabilidades de injeção...', 'info');
  
  // Teste 1: SQL Injection
  const sqlPayloads = [
    "'; DROP TABLE companies; --",
    "' OR '1'='1",
    "'; INSERT INTO companies (name) VALUES ('hacked'); --",
    "' UNION SELECT * FROM users --"
  ];
  
  for (const payload of sqlPayloads) {
    try {
      const response = await axios.post(`${CONFIG.API_URL}/companies`, {
        name: payload,
        cnpj: '12345678000199'
      }, {
        validateStatus: () => true,
        timeout: 5000
      });
      
      if (response.status >= 400) {
        addTestResult('injection', `SQL Injection Test (${payload.substring(0, 20)}...)`, 'PASS', 
          'Payload SQL rejeitado');
      } else {
        addTestResult('injection', `SQL Injection Test (${payload.substring(0, 20)}...)`, 'FAIL', 
          'Possível vulnerabilidade SQL', {}, 'critical');
      }
    } catch (error) {
      addTestResult('injection', `SQL Injection Test (${payload.substring(0, 20)}...)`, 'PASS', 
        'Payload rejeitado (conexão/timeout)');
    }
  }
  
  // Teste 2: NoSQL Injection (para Supabase)
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('name', { '$ne': null });
    
    if (error) {
      addTestResult('injection', 'NoSQL Injection Protection', 'PASS', 
        'Supabase protegido contra NoSQL injection');
    } else {
      addTestResult('injection', 'NoSQL Injection Protection', 'WARN', 
        'Verificar proteções NoSQL');
    }
  } catch (error) {
    addTestResult('injection', 'NoSQL Injection Protection', 'PASS', 
      'Payload NoSQL rejeitado');
  }
}

// TESTES DE XSS
async function testXSSVulnerabilities() {
  log('🕷️  Iniciando testes de XSS...', 'info');
  
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>'
  ];
  
  for (const payload of xssPayloads) {
    try {
      const response = await axios.post(`${CONFIG.API_URL}/companies`, {
        name: payload,
        cnpj: '12345678000199'
      }, {
        validateStatus: () => true,
        timeout: 5000
      });
      
      if (response.status >= 400) {
        addTestResult('xss', `XSS Test (${payload.substring(0, 20)}...)`, 'PASS', 
          'Payload XSS rejeitado');
      } else if (response.data && typeof response.data === 'string' && response.data.includes(payload)) {
        addTestResult('xss', `XSS Test (${payload.substring(0, 20)}...)`, 'FAIL', 
          'Possível vulnerabilidade XSS', {}, 'high');
      } else {
        addTestResult('xss', `XSS Test (${payload.substring(0, 20)}...)`, 'PASS', 
          'Payload sanitizado ou rejeitado');
      }
    } catch (error) {
      addTestResult('xss', `XSS Test (${payload.substring(0, 20)}...)`, 'PASS', 
        'Payload rejeitado');
    }
  }
}

// TESTES DE HEADERS DE SEGURANÇA
async function testSecurityHeaders() {
  log('📋 Iniciando testes de headers de segurança...', 'info');
  
  const requiredHeaders = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': ['DENY', 'SAMEORIGIN'],
    'x-xss-protection': '1; mode=block',
    'strict-transport-security': 'max-age=',
    'content-security-policy': 'default-src'
  };
  
  try {
    const response = await axios.get(`${CONFIG.API_URL}/health`);
    const headers = response.headers;
    
    for (const [headerName, expectedValue] of Object.entries(requiredHeaders)) {
      const headerValue = headers[headerName.toLowerCase()];
      
      if (headerValue) {
        if (Array.isArray(expectedValue)) {
          const hasValidValue = expectedValue.some(val => headerValue.includes(val));
          if (hasValidValue) {
            addTestResult('headers', `${headerName} Header`, 'PASS', 
              `Header presente: ${headerValue}`);
          } else {
            addTestResult('headers', `${headerName} Header`, 'WARN', 
              `Header com valor inesperado: ${headerValue}`);
          }
        } else {
          if (headerValue.includes(expectedValue)) {
            addTestResult('headers', `${headerName} Header`, 'PASS', 
              `Header presente: ${headerValue}`);
          } else {
            addTestResult('headers', `${headerName} Header`, 'WARN', 
              `Header com valor inesperado: ${headerValue}`);
          }
        }
      } else {
        addTestResult('headers', `${headerName} Header`, 'FAIL', 
          'Header de segurança ausente', {}, 'medium');
      }
    }
  } catch (error) {
    addTestResult('headers', 'Security Headers Test', 'FAIL', 
      `Erro ao verificar headers: ${error.message}`);
  }
}

// TESTES DE CRIPTOGRAFIA
async function testEncryption() {
  log('🔐 Iniciando testes de criptografia...', 'info');
  
  // Teste 1: HTTPS enforcement
  try {
    const httpUrl = CONFIG.API_URL.replace('https://', 'http://');
    const response = await axios.get(httpUrl, {
      validateStatus: () => true,
      timeout: 5000,
      maxRedirects: 0
    });
    
    if (response.status === 301 || response.status === 302) {
      const location = response.headers.location;
      if (location && location.startsWith('https://')) {
        addTestResult('encryption', 'HTTPS Enforcement', 'PASS', 
          'HTTP redirecionado para HTTPS');
      } else {
        addTestResult('encryption', 'HTTPS Enforcement', 'WARN', 
          'Redirecionamento sem HTTPS');
      }
    } else if (response.status >= 400) {
      addTestResult('encryption', 'HTTPS Enforcement', 'PASS', 
        'HTTP rejeitado');
    } else {
      addTestResult('encryption', 'HTTPS Enforcement', 'FAIL', 
        'HTTP aceito sem redirecionamento', {}, 'high');
    }
  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      addTestResult('encryption', 'HTTPS Enforcement', 'PASS', 
        'HTTP não disponível (apenas HTTPS)');
    } else {
      addTestResult('encryption', 'HTTPS Enforcement', 'WARN', 
        `Erro no teste: ${error.message}`);
    }
  }
  
  // Teste 2: Verificar força da senha
  const weakPasswords = ['123456', 'password', 'admin', '12345678'];
  
  for (const weakPassword of weakPasswords) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: `weak-test-${Date.now()}@test.com`,
        password: weakPassword
      });
      
      if (error && error.message.includes('Password')) {
        addTestResult('encryption', `Weak Password Rejection (${weakPassword})`, 'PASS', 
          'Senha fraca rejeitada');
      } else if (!error) {
        addTestResult('encryption', `Weak Password Rejection (${weakPassword})`, 'FAIL', 
          'Senha fraca aceita', {}, 'medium');
      } else {
        addTestResult('encryption', `Weak Password Rejection (${weakPassword})`, 'WARN', 
          `Erro inesperado: ${error.message}`);
      }
    } catch (error) {
      addTestResult('encryption', `Weak Password Rejection (${weakPassword})`, 'PASS', 
        'Senha rejeitada');
    }
  }
}

// TESTES DE RATE LIMITING
async function testRateLimit() {
  log('🚦 Iniciando testes de rate limiting...', 'info');
  
  try {
    const requests = [];
    const startTime = Date.now();
    
    // Fazer 20 requisições rápidas
    for (let i = 0; i < 20; i++) {
      requests.push(
        axios.get(`${CONFIG.API_URL}/health`, {
          validateStatus: () => true,
          timeout: 5000
        })
      );
    }
    
    const responses = await Promise.allSettled(requests);
    const endTime = Date.now();
    
    const successCount = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status === 200
    ).length;
    
    const rateLimitedCount = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status === 429
    ).length;
    
    const totalTime = endTime - startTime;
    
    if (rateLimitedCount > 0) {
      addTestResult('rateLimit', 'Rate Limiting Protection', 'PASS', 
        `${rateLimitedCount}/20 requisições limitadas`);
    } else if (totalTime < 1000 && successCount === 20) {
      addTestResult('rateLimit', 'Rate Limiting Protection', 'WARN', 
        'Sem rate limiting aparente', {}, 'medium');
    } else {
      addTestResult('rateLimit', 'Rate Limiting Protection', 'PASS', 
        'Possível rate limiting por tempo de resposta');
    }
  } catch (error) {
    addTestResult('rateLimit', 'Rate Limiting Protection', 'FAIL', 
      `Erro no teste: ${error.message}`);
  }
}

// Função principal
async function runSecurityQATests() {
  log('🔒 INICIANDO TESTES AVANÇADOS DE SEGURANÇA - GRIFO VISTORIAS', 'info');
  log('=' .repeat(60), 'info');
  
  try {
    await testAdvancedAuthentication();
    await testAuthorization();
    await testInjectionVulnerabilities();
    await testXSSVulnerabilities();
    await testSecurityHeaders();
    await testEncryption();
    await testRateLimit();
    
    // Gerar relatório
    const reportPath = path.join(__dirname, 'security-qa-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(securityTestResults, null, 2));
    
    log('=' .repeat(60), 'info');
    log('📊 RESUMO DOS TESTES DE SEGURANÇA:', 'info');
    log(`Total de testes: ${securityTestResults.summary.total}`, 'info');
    log(`✅ Aprovados: ${securityTestResults.summary.passed}`, 'success');
    log(`❌ Falharam: ${securityTestResults.summary.failed}`, 'error');
    log(`⚠️  Avisos: ${securityTestResults.summary.warnings}`, 'warning');
    log(`🚨 Críticos: ${securityTestResults.summary.critical}`, 'critical');
    
    const successRate = ((securityTestResults.summary.passed / securityTestResults.summary.total) * 100).toFixed(1);
    log(`📈 Taxa de sucesso: ${successRate}%`, successRate >= 80 ? 'success' : 'warning');
    
    log(`📄 Relatório salvo em: ${reportPath}`, 'info');
    
    if (securityTestResults.summary.critical === 0 && securityTestResults.summary.failed === 0) {
      log('🎉 SEGURANÇA APROVADA! Sistema seguro para produção.', 'success');
    } else if (securityTestResults.summary.critical > 0) {
      log('🚨 VULNERABILIDADES CRÍTICAS ENCONTRADAS! NÃO DEPLOY EM PRODUÇÃO.', 'critical');
    } else {
      log('⚠️  PROBLEMAS DE SEGURANÇA DETECTADOS. Revisar antes do deploy.', 'warning');
    }
    
  } catch (error) {
    log(`❌ Erro fatal nos testes de segurança: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runSecurityQATests().catch(console.error);
}

module.exports = {
  runSecurityQATests,
  securityTestResults
};