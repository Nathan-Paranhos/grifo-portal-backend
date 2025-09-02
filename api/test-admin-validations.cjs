/**
 * Script de teste para validações administrativas
 * Testa as funcionalidades de validação de usuários admin implementadas
 */

const { verifyAdminCredentials, verifyAdminById, updateLastLogin } = require('./src/utils/adminAuth.js');
const { logLogin, logResourceAccess, logDataChange } = require('./src/utils/auditLogger.js');
const { supabase } = require('./src/config/supabase.js');

// Configuração de teste
const TEST_CONFIG = {
  // Credenciais de teste - substitua pelos dados reais do seu banco
  validAdmin: {
    email: 'admin@grifo.com',
    password: 'admin123' // Senha de teste
  },
  invalidAdmin: {
    email: 'user@grifo.com',
    password: 'user123'
  },
  nonExistentUser: {
    email: 'naoexiste@grifo.com',
    password: 'senha123'
  }
};

/**
 * Função para executar testes de validação administrativa
 */
async function runAdminValidationTests() {
  console.log('🚀 Iniciando testes de validação administrativa...\n');

  // Teste 1: Verificar credenciais de admin válido
  console.log('📋 Teste 1: Verificando credenciais de admin válido');
  try {
    const result = await verifyAdminCredentials(
      TEST_CONFIG.validAdmin.email,
      TEST_CONFIG.validAdmin.password
    );
    
    if (result.success) {
      console.log('✅ Admin válido autenticado com sucesso');
      console.log(`   Usuário: ${result.user.email} (${result.user.user_type})`);
      
      // Testar log de acesso
      await logLogin(
        result.user.email,
        true,
        'test_validation',
        { auditInfo: { ip: '127.0.0.1', user_agent: 'Test-User-Agent' } }
      );
      console.log('✅ Log de acesso administrativo registrado');
      
    } else {
      console.log('❌ Falha na autenticação do admin válido:', result.error);
    }
  } catch (error) {
    console.log('❌ Erro no teste 1:', error.message);
  }
  console.log('');

  // Teste 2: Verificar credenciais de usuário não-admin
  console.log('📋 Teste 2: Verificando credenciais de usuário não-admin');
  try {
    const result = await verifyAdminCredentials(
      TEST_CONFIG.invalidAdmin.email,
      TEST_CONFIG.invalidAdmin.password
    );
    
    if (!result.success) {
      console.log('✅ Usuário não-admin corretamente rejeitado');
      console.log(`   Motivo: ${result.error}`);
      
      // Testar log de falha
      await logLogin(
        TEST_CONFIG.invalidAdmin.email,
        false,
        result.code || 'invalid_credentials',
        { auditInfo: { ip: '127.0.0.1', user_agent: 'Test-User-Agent' } }
      );
      console.log('✅ Log de falha de acesso registrado');
      
    } else {
      console.log('❌ Usuário não-admin foi incorretamente aceito');
    }
  } catch (error) {
    console.log('❌ Erro no teste 2:', error.message);
  }
  console.log('');

  // Teste 3: Verificar usuário inexistente
  console.log('📋 Teste 3: Verificando usuário inexistente');
  try {
    const result = await verifyAdminCredentials(
      TEST_CONFIG.nonExistentUser.email,
      TEST_CONFIG.nonExistentUser.password
    );
    
    if (!result.success) {
      console.log('✅ Usuário inexistente corretamente rejeitado');
      console.log(`   Motivo: ${result.error}`);
    } else {
      console.log('❌ Usuário inexistente foi incorretamente aceito');
    }
  } catch (error) {
    console.log('❌ Erro no teste 3:', error.message);
  }
  console.log('');

  // Teste 4: Verificar logs de auditoria
  console.log('📋 Teste 4: Verificando logs de auditoria');
  try {
    // Testar log de acesso a recurso
    await logResourceAccess(
      'test_resource',
      'access',
      { id: 'test-user-id', email: 'admin@grifo.com', user_type: 'admin' },
      true,
      { auditInfo: { ip: '127.0.0.1', user_agent: 'Test-User-Agent' } }
    );
    console.log('✅ Log de acesso a recurso registrado');
    
    // Testar log de alteração de dados
    await logDataChange(
      'test_table',
      'test-record-id',
      { old_value: 'antigo', new_value: 'novo' },
      { id: 'test-user-id', email: 'admin@grifo.com', user_type: 'admin' },
      { auditInfo: { ip: '127.0.0.1', user_agent: 'Test-User-Agent' } }
    );
    console.log('✅ Log de alteração de dados registrado');
    
  } catch (error) {
    console.log('❌ Erro no teste 4:', error.message);
  }
  console.log('');

  // Teste 5: Verificar estrutura da tabela de auditoria
  console.log('📋 Teste 5: Verificando estrutura da tabela de auditoria');
  try {
    const { data: auditLogs, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) {
      console.log('❌ Erro ao consultar logs de auditoria:', error.message);
    } else {
      console.log(`✅ Tabela de auditoria acessível - ${auditLogs.length} registros encontrados`);
      if (auditLogs.length > 0) {
        console.log('   Último log:', {
          type: auditLogs[0].type,
          action: auditLogs[0].action,
          user_email: auditLogs[0].user_email,
          timestamp: auditLogs[0].timestamp
        });
      }
    }
  } catch (error) {
    console.log('❌ Erro no teste 5:', error.message);
  }
  console.log('');

  console.log('🏁 Testes de validação administrativa concluídos!');
}

/**
 * Função para testar permissões de usuários
 */
async function testUserPermissions() {
  console.log('\n🔐 Testando permissões de usuários...');
  
  try {
    // Buscar usuários de diferentes tipos
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, user_type, is_active, status')
      .in('user_type', ['admin', 'super_admin', 'empresa_admin', 'client'])
      .limit(10);
    
    if (error) {
      console.log('❌ Erro ao buscar usuários:', error.message);
      return;
    }
    
    console.log(`✅ Encontrados ${users.length} usuários para teste:`);
    
    users.forEach(user => {
      console.log(`   - ${user.email} (${user.user_type}) - Ativo: ${user.is_active} - Status: ${user.status}`);
    });
    
    // Testar verificação por ID para cada usuário
    for (const user of users) {
      const result = await verifyAdminById(user.id);
      const isAdmin = ['admin', 'super_admin', 'empresa_admin'].includes(user.user_type);
      
      if (isAdmin && result.success) {
        console.log(`   ✅ ${user.email}: Corretamente identificado como admin`);
      } else if (!isAdmin && !result.success) {
        console.log(`   ✅ ${user.email}: Corretamente rejeitado (não é admin)`);
      } else {
        console.log(`   ❌ ${user.email}: Resultado inesperado - Expected admin: ${isAdmin}, Got success: ${result.success}`);
      }
    }
    
  } catch (error) {
    console.log('❌ Erro no teste de permissões:', error.message);
  }
}

// Executar os testes
if (require.main === module) {
  (async () => {
    try {
      await runAdminValidationTests();
      await testUserPermissions();
      
      console.log('\n📊 Resumo dos testes:');
      console.log('- Validação de credenciais administrativas');
      console.log('- Rejeição de usuários não-admin');
      console.log('- Logs de auditoria');
      console.log('- Verificação de permissões por tipo de usuário');
      console.log('\n💡 Para executar este teste:');
      console.log('   node test-admin-validations.js');
      console.log('\n⚠️  Certifique-se de ter usuários de teste no banco de dados!');
      
    } catch (error) {
      console.error('❌ Erro geral nos testes:', error);
    } finally {
      process.exit(0);
    }
  })();
}

module.exports = { runAdminValidationTests, testUserPermissions };