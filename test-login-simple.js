const axios = require('axios');

console.log('🔐 TESTE SIMPLES DE LOGIN LOCAL');
console.log('=' .repeat(50));

async function testLoginSimple() {
  try {
    console.log('\n1. Testando login...');
    const response = await axios.post('http://localhost:3002/api/v1/auth/portal/login', {
      email: 'paranhoscontato.n@gmail.com',
      password: 'Teste@2025'
    });

    console.log('✅ Login Status:', response.status);
    console.log('✅ Login bem-sucedido!');
    
    // Verificar estrutura da resposta
    console.log('\n📋 Estrutura da resposta:');
    console.log('- success:', response.data.success);
    console.log('- message:', response.data.message);
    console.log('- data keys:', Object.keys(response.data.data || {}));
    
    // Extrair token
    const tokenData = response.data.data;
    const accessToken = tokenData?.access_token;
    
    if (accessToken) {
      console.log('\n✅ Access Token encontrado!');
      console.log('Token length:', accessToken.length);
      console.log('Token preview:', accessToken.substring(0, 50) + '...');
      
      // Testar endpoint protegido
      console.log('\n2. Testando endpoint protegido /api/v1/auth/me...');
      
      try {
        const meResponse = await axios.get('http://localhost:3002/api/v1/auth/me', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Endpoint /me Status:', meResponse.status);
        console.log('✅ Dados do usuário autenticado:');
        console.log(JSON.stringify(meResponse.data, null, 2));
        
      } catch (meError) {
        console.log('❌ Erro no endpoint /me:');
        console.log('Status:', meError.response?.status);
        console.log('Error:', meError.response?.data || meError.message);
      }
      
    } else {
      console.log('❌ Access Token não encontrado na resposta');
      console.log('Dados disponíveis:', JSON.stringify(response.data, null, 2));
    }
    
  } catch (error) {
    console.log('❌ Erro no login:');
    console.log('Status:', error.response?.status);
    console.log('Error:', error.response?.data || error.message);
  }
}

testLoginSimple();