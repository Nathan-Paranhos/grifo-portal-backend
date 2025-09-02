require('dotenv').config({ path: './api/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Definida' : 'Não definida');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Definida' : 'Não definida');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAuthUsers() {
  try {
    console.log('🔍 Verificando usuários no auth.users...');
    
    // Tentar query direta na tabela auth.users
    const { data: authUsers, error: authError } = await supabase
      .from('auth.users')
      .select('id, email, created_at')
      .limit(10);
    
    if (authError) {
      console.log('❌ Erro ao consultar auth.users:', authError.message);
      
      // Tentar usando rpc ou admin API
      console.log('🔄 Tentando usar Admin API...');
      const { data: adminUsers, error: adminError } = await supabase.auth.admin.listUsers();
      
      if (adminError) {
        console.log('❌ Erro no Admin API:', adminError.message);
      } else {
        console.log('✅ Usuários encontrados via Admin API:', adminUsers.users.length);
        adminUsers.users.forEach(user => {
          console.log(`📧 ${user.email} - ID: ${user.id}`);
        });
        
        // Procurar o usuário específico
        const targetUser = adminUsers.users.find(u => u.email === 'paranhoscontato.n@gmail.com');
        if (targetUser) {
          console.log('🎯 Usuário encontrado:', targetUser.id);
          return targetUser;
        } else {
          console.log('❌ Usuário paranhoscontato.n@gmail.com não encontrado');
        }
      }
    } else {
      console.log('✅ Usuários encontrados via query direta:', authUsers.length);
      authUsers.forEach(user => {
        console.log(`📧 ${user.email} - ID: ${user.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

checkAuthUsers().then(() => {
  console.log('🏁 Verificação concluída');
}).catch(error => {
  console.error('❌ Erro na execução:', error.message);
});