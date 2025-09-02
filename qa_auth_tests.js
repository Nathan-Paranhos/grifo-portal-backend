// QA Authentication and Authorization Tests
// Testes completos de autenticação e autorização

const axios = require('axios');
const fs = require('fs');

const API_BASE_URL = 'http://localhost:5000/api/v1';
const PORTAL_BASE_URL = 'http://localhost:3000';

// Credenciais de teste
const TEST_CREDENTIALS = {
  portal: {
    email: 'paranhoscontato.n@gmail.com',
    password: '23362336@Np10'
  },
  app: {
    email: 'test@example.com',
    password: 'testpassword'
  }
};

class QAAuthTester {
  constructor() {
    this.results = [];
    this.tokens = {};
  }

  log(test, status, message, details = null) {
    const result = {
      timestamp: new Date().toISOString(),
      test,
      status,
      message,
      details
    };
    this.results.push(result);
    console.log(`[${status.toUpperCase()}] ${test}: ${message}`);
    if (details) console.log('Details:', details);
  }

  async testPortalLogin() {
    try {
      console.log('\n=== TESTE DE LOGIN DO PORTAL ===');
      
      const response = await axios.post(`${API_BASE_URL}/auth/portal/login`, {
        email: TEST_CREDENTIALS.portal.email,
        password: TEST_CREDENTIALS.portal.password
      });

      if (response.status === 200 && response.data.token) {
        this.tokens.portal = response.data.token;
        this.log('Portal Login', 'PASS', 'Login realizado com sucesso', {
          token: response.data.token.substring(0, 20) + '...',
          user: response.data.user
        });
        return true;
      } else {
        this.log('Portal Login', 'FAIL', 'Resposta inválida do login', response.data);
        return false;
      }
    } catch (error) {
      this.log('Portal Login', 'FAIL', 'Erro no login do portal', {
        message: error.message,
        response: error.response?.data
      });
      return false;
    }
  }

  async testAppLogin() {
    try {
      console.log('\n=== TESTE DE LOGIN DO APP ===');
      
      const response = await axios.post(`${API_BASE_URL}/auth/app/login`, {
        email: TEST_CREDENTIALS.app.email,
        password: TEST_CREDENTIALS.app.password
      });

      if (response.status === 200 && response.data.token) {
        this.tokens.app = response.data.token;
        this.log('App Login', 'PASS', 'Login do app realizado com sucesso', {
          token: response.data.token.substring(0, 20) + '...',
          user: response.data.user
        });
        return true;
      } else {
        this.log('App Login', 'FAIL', 'Resposta inválida do login do app', response.data);
        return false;
      }
    } catch (error) {
      this.log('App Login', 'FAIL', 'Erro no login do app', {
        message: error.message,
        response: error.response?.data
      });
      return false;
    }
  }

  async testInvalidCredentials() {
    try {
      console.log('\n=== TESTE DE CREDENCIAIS INVÁLIDAS ===');
      
      const response = await axios.post(`${API_BASE_URL}/auth/portal/login`, {
        email: 'invalid@email.com',
        password: 'wrongpassword'
      });

      this.log('Invalid Credentials', 'FAIL', 'Login deveria ter falhado mas passou', response.data);
      return false;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 400) {
        this.log('Invalid Credentials', 'PASS', 'Login rejeitado corretamente para credenciais inválidas');
        return true;
      } else {
        this.log('Invalid Credentials', 'FAIL', 'Erro inesperado', {
          status: error.response?.status,
          message: error.message
        });
        return false;
      }
    }
  }

  async testTokenValidation() {
    try {
      console.log('\n=== TESTE DE VALIDAÇÃO DE TOKEN ===');
      
      if (!this.tokens.portal) {
        this.log('Token Validation', 'SKIP', 'Token do portal não disponível');
        return false;
      }

      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.tokens.portal}`
        }
      });

      if (response.status === 200 && response.data.user) {
        this.log('Token Validation', 'PASS', 'Token validado com sucesso', {
          user: response.data.user
        });
        return true;
      } else {
        this.log('Token Validation', 'FAIL', 'Resposta inválida na validação do token', response.data);
        return false;
      }
    } catch (error) {
      this.log('Token Validation', 'FAIL', 'Erro na validação do token', {
        message: error.message,
        response: error.response?.data
      });
      return false;
    }
  }

  async testUnauthorizedAccess() {
    try {
      console.log('\n=== TESTE DE ACESSO NÃO AUTORIZADO ===');
      
      const response = await axios.get(`${API_BASE_URL}/vistorias`);
      
      this.log('Unauthorized Access', 'FAIL', 'Acesso deveria ter sido negado mas foi permitido', response.data);
      return false;
    } catch (error) {
      if (error.response?.status === 401) {
        this.log('Unauthorized Access', 'PASS', 'Acesso negado corretamente sem token');
        return true;
      } else {
        this.log('Unauthorized Access', 'FAIL', 'Erro inesperado', {
          status: error.response?.status,
          message: error.message
        });
        return false;
      }
    }
  }

  async testAuthorizedAccess() {
    try {
      console.log('\n=== TESTE DE ACESSO AUTORIZADO ===');
      
      if (!this.tokens.portal) {
        this.log('Authorized Access', 'SKIP', 'Token do portal não disponível');
        return false;
      }

      const response = await axios.get(`${API_BASE_URL}/vistorias`, {
        headers: {
          'Authorization': `Bearer ${this.tokens.portal}`
        }
      });

      if (response.status === 200) {
        this.log('Authorized Access', 'PASS', 'Acesso autorizado funcionando corretamente', {
          totalVistorias: Array.isArray(response.data) ? response.data.length : 'N/A'
        });
        return true;
      } else {
        this.log('Authorized Access', 'FAIL', 'Resposta inesperada', response.data);
        return false;
      }
    } catch (error) {
      this.log('Authorized Access', 'FAIL', 'Erro no acesso autorizado', {
        message: error.message,
        response: error.response?.data
      });
      return false;
    }
  }

  async testPasswordSecurity() {
    try {
      console.log('\n=== TESTE DE SEGURANÇA DE SENHA ===');
      
      // Teste com senha muito simples
      const weakPasswords = ['123', '123456', 'password', 'abc'];
      let weakPasswordRejected = false;

      for (const weakPassword of weakPasswords) {
        try {
          await axios.post(`${API_BASE_URL}/auth/portal/register`, {
            email: 'test@weak.com',
            password: weakPassword,
            name: 'Test User'
          });
        } catch (error) {
          if (error.response?.status === 400) {
            weakPasswordRejected = true;
            break;
          }
        }
      }

      if (weakPasswordRejected) {
        this.log('Password Security', 'PASS', 'Senhas fracas rejeitadas corretamente');
        return true;
      } else {
        this.log('Password Security', 'WARN', 'Sistema pode estar aceitando senhas fracas');
        return false;
      }
    } catch (error) {
      this.log('Password Security', 'FAIL', 'Erro no teste de segurança de senha', {
        message: error.message
      });
      return false;
    }
  }

  async testRateLimiting() {
    try {
      console.log('\n=== TESTE DE RATE LIMITING ===');
      
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          axios.post(`${API_BASE_URL}/auth/portal/login`, {
            email: 'invalid@test.com',
            password: 'invalid'
          }).catch(err => err.response)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(response => 
        response?.status === 429 || 
        (response?.data && response.data.message && response.data.message.includes('rate'))
      );

      if (rateLimited) {
        this.log('Rate Limiting', 'PASS', 'Rate limiting funcionando corretamente');
        return true;
      } else {
        this.log('Rate Limiting', 'WARN', 'Rate limiting pode não estar configurado');
        return false;
      }
    } catch (error) {
      this.log('Rate Limiting', 'FAIL', 'Erro no teste de rate limiting', {
        message: error.message
      });
      return false;
    }
  }

  async runAllTests() {
    console.log('🚀 INICIANDO TESTES DE AUTENTICAÇÃO E AUTORIZAÇÃO\n');
    
    const tests = [
      () => this.testPortalLogin(),
      () => this.testAppLogin(),
      () => this.testInvalidCredentials(),
      () => this.testTokenValidation(),
      () => this.testUnauthorizedAccess(),
      () => this.testAuthorizedAccess(),
      () => this.testPasswordSecurity(),
      () => this.testRateLimiting()
    ];

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const test of tests) {
      try {
        const result = await test();
        if (result === true) passed++;
        else if (result === false) failed++;
        else skipped++;
      } catch (error) {
        console.error('Erro executando teste:', error.message);
        failed++;
      }
      
      // Pequena pausa entre testes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 RESUMO DOS TESTES DE AUTENTICAÇÃO:');
    console.log(`✅ Passou: ${passed}`);
    console.log(`❌ Falhou: ${failed}`);
    console.log(`⏭️ Pulou: ${skipped}`);
    console.log(`📈 Taxa de sucesso: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

    // Salvar resultados
    const reportPath = 'qa_auth_report.json';
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: { passed, failed, skipped },
      results: this.results,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n📄 Relatório salvo em: ${reportPath}`);
    
    return { passed, failed, skipped };
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const tester = new QAAuthTester();
  tester.runAllTests().catch(console.error);
}

module.exports = QAAuthTester;