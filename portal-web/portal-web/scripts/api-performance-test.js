const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuração da API
const API_BASE_URL = 'http://localhost:5000/api';
const CONCURRENT_REQUESTS = [1, 5, 10, 20, 50];
const TEST_DURATION = 30000; // 30 segundos

// Endpoints para testar
const ENDPOINTS = [
  { name: 'Health Check', method: 'GET', path: '/health' },
  { name: 'Login', method: 'POST', path: '/auth/login', data: { email: 'admin@grifo.com', password: 'admin123' } },
  { name: 'Clientes List', method: 'GET', path: '/clientes' },
  { name: 'Vistorias List', method: 'GET', path: '/vistorias' },
  { name: 'Create Cliente', method: 'POST', path: '/clientes', data: {
    nome: 'Cliente Teste Performance',
    email: 'teste@performance.com',
    telefone: '11999999999',
    cpf: '12345678901'
  }}
];

class PerformanceAnalyzer {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      summary: {},
      detailed: [],
      errors: []
    };
  }

  async makeRequest(endpoint, token = null) {
    const startTime = Date.now();
    try {
      const config = {
        method: endpoint.method,
        url: `${API_BASE_URL}${endpoint.path}`,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      };

      if (endpoint.data) {
        config.data = endpoint.data;
      }

      const response = await axios(config);
      const endTime = Date.now();
      
      return {
        success: true,
        statusCode: response.status,
        responseTime: endTime - startTime,
        dataSize: JSON.stringify(response.data).length
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        success: false,
        statusCode: error.response?.status || 0,
        responseTime: endTime - startTime,
        error: error.message,
        dataSize: 0
      };
    }
  }

  async runConcurrentTest(endpoint, concurrency, duration, token = null) {
    console.log(`\n🔄 Testando ${endpoint.name} com ${concurrency} requisições concorrentes por ${duration/1000}s`);
    
    const results = [];
    const startTime = Date.now();
    let requestCount = 0;
    let successCount = 0;
    let errorCount = 0;
    
    const workers = [];
    
    // Criar workers concorrentes
    for (let i = 0; i < concurrency; i++) {
      const worker = async () => {
        while (Date.now() - startTime < duration) {
          const result = await this.makeRequest(endpoint, token);
          results.push(result);
          requestCount++;
          
          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            this.results.errors.push({
              endpoint: endpoint.name,
              concurrency,
              error: result.error,
              timestamp: new Date().toISOString()
            });
          }
          
          // Pequena pausa para evitar sobrecarga
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      };
      
      workers.push(worker());
    }
    
    // Aguardar todos os workers
    await Promise.all(workers);
    
    const totalTime = Date.now() - startTime;
    const responseTimes = results.filter(r => r.success).map(r => r.responseTime);
    
    const stats = {
      endpoint: endpoint.name,
      concurrency,
      duration: totalTime,
      totalRequests: requestCount,
      successfulRequests: successCount,
      failedRequests: errorCount,
      successRate: (successCount / requestCount * 100).toFixed(2),
      requestsPerSecond: (requestCount / (totalTime / 1000)).toFixed(2),
      avgResponseTime: responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2) : 0,
      minResponseTime: responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      maxResponseTime: responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      p95ResponseTime: responseTimes.length > 0 ? this.calculatePercentile(responseTimes, 95).toFixed(2) : 0,
      p99ResponseTime: responseTimes.length > 0 ? this.calculatePercentile(responseTimes, 99).toFixed(2) : 0
    };
    
    console.log(`✅ ${stats.totalRequests} requisições | ${stats.successRate}% sucesso | ${stats.requestsPerSecond} req/s | ${stats.avgResponseTime}ms média`);
    
    return stats;
  }

  calculatePercentile(arr, percentile) {
    const sorted = arr.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  async getAuthToken() {
    try {
      const loginEndpoint = ENDPOINTS.find(e => e.name === 'Login');
      const result = await this.makeRequest(loginEndpoint);
      
      if (result.success && result.statusCode === 200) {
        // Assumindo que o token está na resposta
        return 'mock-token'; // Ajustar conforme a estrutura real da API
      }
    } catch (error) {
      console.log('⚠️  Não foi possível obter token de autenticação');
    }
    return null;
  }

  async runFullAnalysis() {
    console.log('🚀 Iniciando Análise de Performance da API Grifo');
    console.log('=' .repeat(60));
    
    // Verificar se a API está online
    console.log('🔍 Verificando conectividade da API...');
    const healthCheck = await this.makeRequest({ name: 'Health', method: 'GET', path: '/health' });
    
    if (!healthCheck.success) {
      console.log('❌ API não está respondendo. Verificando endpoints alternativos...');
      // Tentar endpoint raiz
      const rootCheck = await this.makeRequest({ name: 'Root', method: 'GET', path: '/' });
      if (!rootCheck.success) {
        console.log('❌ API completamente inacessível');
        this.results.summary.apiStatus = 'offline';
        return this.generateReport();
      }
    }
    
    console.log('✅ API está online');
    this.results.summary.apiStatus = 'online';
    
    // Obter token de autenticação
    const token = await this.getAuthToken();
    
    // Executar testes para cada endpoint
    for (const endpoint of ENDPOINTS) {
      console.log(`\n📊 Analisando endpoint: ${endpoint.name}`);
      
      for (const concurrency of CONCURRENT_REQUESTS) {
        const stats = await this.runConcurrentTest(endpoint, concurrency, TEST_DURATION, token);
        this.results.detailed.push(stats);
        
        // Pausa entre testes
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Calcular estatísticas gerais
    this.calculateSummaryStats();
    
    // Gerar relatório
    return this.generateReport();
  }

  calculateSummaryStats() {
    const allStats = this.results.detailed;
    
    if (allStats.length === 0) {
      this.results.summary = { ...this.results.summary, message: 'Nenhum teste executado' };
      return;
    }
    
    const avgResponseTimes = allStats.map(s => parseFloat(s.avgResponseTime));
    const requestsPerSecond = allStats.map(s => parseFloat(s.requestsPerSecond));
    const successRates = allStats.map(s => parseFloat(s.successRate));
    
    this.results.summary = {
      ...this.results.summary,
      totalTests: allStats.length,
      avgResponseTime: (avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length).toFixed(2),
      maxThroughput: Math.max(...requestsPerSecond).toFixed(2),
      avgSuccessRate: (successRates.reduce((a, b) => a + b, 0) / successRates.length).toFixed(2),
      totalErrors: this.results.errors.length,
      recommendations: this.generateRecommendations(allStats)
    };
  }

  generateRecommendations(stats) {
    const recommendations = [];
    
    const avgResponseTime = parseFloat(this.results.summary.avgResponseTime);
    const avgSuccessRate = parseFloat(this.results.summary.avgSuccessRate);
    
    if (avgResponseTime > 1000) {
      recommendations.push('Tempo de resposta alto (>1s). Considere otimização de queries e cache.');
    }
    
    if (avgSuccessRate < 95) {
      recommendations.push('Taxa de sucesso baixa (<95%). Verifique estabilidade da API.');
    }
    
    const highConcurrencyTests = stats.filter(s => s.concurrency >= 20);
    const failingHighConcurrency = highConcurrencyTests.filter(s => parseFloat(s.successRate) < 90);
    
    if (failingHighConcurrency.length > 0) {
      recommendations.push('Performance degrada com alta concorrência. Considere implementar rate limiting e load balancing.');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance da API está dentro dos parâmetros aceitáveis.');
    }
    
    return recommendations;
  }

  async generateReport() {
    const reportDir = path.join(__dirname, '..', 'test-results');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportPath = path.join(reportDir, 'api-performance-report.json');
    
    // Salvar relatório JSON
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    
    // Gerar relatório em texto
    const textReport = this.generateTextReport();
    const textReportPath = path.join(reportDir, 'api-performance-report.txt');
    fs.writeFileSync(textReportPath, textReport);
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 RELATÓRIO DE PERFORMANCE DA API');
    console.log('='.repeat(60));
    console.log(textReport);
    
    console.log(`\n📁 Relatórios salvos em:`);
    console.log(`   JSON: ${reportPath}`);
    console.log(`   TXT:  ${textReportPath}`);
    
    return this.results;
  }

  generateTextReport() {
    const s = this.results.summary;
    let report = '';
    
    report += `Status da API: ${s.apiStatus}\n`;
    report += `Timestamp: ${this.results.timestamp}\n\n`;
    
    if (s.apiStatus === 'online') {
      report += `RESUMO GERAL:\n`;
      report += `- Total de testes: ${s.totalTests}\n`;
      report += `- Tempo médio de resposta: ${s.avgResponseTime}ms\n`;
      report += `- Throughput máximo: ${s.maxThroughput} req/s\n`;
      report += `- Taxa média de sucesso: ${s.avgSuccessRate}%\n`;
      report += `- Total de erros: ${s.totalErrors}\n\n`;
      
      report += `RECOMENDAÇÕES:\n`;
      s.recommendations.forEach(rec => {
        report += `- ${rec}\n`;
      });
      
      report += `\nDETALHES POR ENDPOINT:\n`;
      const endpointGroups = {};
      this.results.detailed.forEach(test => {
        if (!endpointGroups[test.endpoint]) {
          endpointGroups[test.endpoint] = [];
        }
        endpointGroups[test.endpoint].push(test);
      });
      
      Object.keys(endpointGroups).forEach(endpoint => {
        report += `\n${endpoint}:\n`;
        endpointGroups[endpoint].forEach(test => {
          report += `  ${test.concurrency} concurrent: ${test.avgResponseTime}ms avg, ${test.requestsPerSecond} req/s, ${test.successRate}% success\n`;
        });
      });
    }
    
    if (this.results.errors.length > 0) {
      report += `\nERROS ENCONTRADOS:\n`;
      this.results.errors.slice(0, 10).forEach(error => {
        report += `- ${error.endpoint} (${error.concurrency} concurrent): ${error.error}\n`;
      });
      
      if (this.results.errors.length > 10) {
        report += `... e mais ${this.results.errors.length - 10} erros\n`;
      }
    }
    
    return report;
  }
}

// Executar análise
async function main() {
  const analyzer = new PerformanceAnalyzer();
  
  try {
    await analyzer.runFullAnalysis();
    console.log('\n✅ Análise de performance concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro durante análise de performance:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = PerformanceAnalyzer;