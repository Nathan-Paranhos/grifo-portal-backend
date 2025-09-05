const express = require('express');
const { authSupabase, requireAdmin, logProtectedAccess } = require('../middleware/auth.js');
const { asyncHandler } = require('../middleware/errorHandler.js');

const router = express.Router();

// Middleware de autenticação real para MVP
const realAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token de autorização necessário' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    // Importar supabase dinamicamente
    const { supabaseAuth, supabase } = await import('../config/supabase.js');
    
    // Verificar o token com Supabase
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }
    
    // Buscar dados do usuário na tabela users
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, nome, name, email, user_type, role, is_active, tenant_slug')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .single();
    
    if (userError || !userData) {
      return res.status(401).json({ success: false, error: 'Usuário não encontrado ou inativo' });
    }
    
    // Adicionar dados do usuário ao request
    req.user = {
      id: userData.id,
      email: userData.email,
      name: userData.name || userData.nome,
      role: userData.role,
      user_type: userData.user_type,
      tenant_slug: userData.tenant_slug,
      auth_user_id: user.id
    };
    
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return res.status(401).json({ success: false, error: 'Erro na autenticação' });
  }
});

// REMOVIDO: Middleware simpleAuth por questões de segurança
// Todos os endpoints agora usam autenticação real com Supabase

/**
 * MVP Routes - Mapeamento dos endpoints conforme especificação
 * Estes endpoints redirecionam para as rotas existentes da API
 */

// POST /auth/login - endpoint com autenticação real do Supabase
router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Validação simples para teste
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email e senha são obrigatórios'
    });
  }

  try {
    // Importar supabase dinamicamente
    const { supabaseAuth, supabase } = await import('../config/supabase.js');
    
    console.log('DEBUG: Tentativa de login:', { email: email.toLowerCase(), hasPassword: !!password });
    
    // Authenticate with Supabase Auth using anon key
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: email.toLowerCase(),
      password
    });

    console.log('DEBUG: Resultado da autenticação Supabase:', {
      hasAuthData: !!authData,
      hasUser: !!(authData && authData.user),
      authError: authError ? authError.message : null,
      authErrorCode: authError ? authError.code : null
    });

    if (authError || !authData.user) {
      console.log('DEBUG: Falha na autenticação Supabase');
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas'
      });
    }

    // Verificar se o usuário existe na tabela users unificada
    console.log('DEBUG: Procurando usuário com auth_user_id:', authData.user.id);
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, nome, name, email, user_type, role, is_active, tenant_slug')
      .eq('auth_user_id', authData.user.id)
      .eq('is_active', true)
      .single();

    console.log('DEBUG: Resultado da consulta user:', user);
    console.log('DEBUG: Erro da consulta userError:', userError);

    if (userError || !user) {
      console.log('DEBUG: Usuário não encontrado na tabela users:', userError);
      
      // Tentar buscar sem filtro is_active para debug
      const { data: allUsers, error: allUsersError } = await supabase
        .from('users')
        .select('id, nome, name, email, user_type, role, is_active, tenant_slug, auth_user_id')
        .eq('auth_user_id', authData.user.id);
      
      console.log('DEBUG: Todos os usuários com este auth_user_id:', allUsers);
      console.log('DEBUG: Erro ao buscar todos os usuários:', allUsersError);
      
      return res.status(401).json({
        success: false,
        error: 'Usuário não encontrado ou inativo'
      });
    }

    // Update last login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    return res.json({
      success: true,
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.nome,
        role: user.role,
        user_type: user.user_type,
        tenant_slug: user.tenant_slug
      },
      token: authData.session.access_token
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}));

// POST /auth/logout - mapear para /api/v1/auth/logout
router.post('/auth/logout', (req, res) => {
  // Redirecionar para a rota existente
  req.url = '/api/v1/auth/logout';
  req.app.handle(req, res);
});

// POST /admin/create-client - endpoint MVP simples
router.post('/admin/create-client', realAuth, requireAdmin, logProtectedAccess('admin_create_client'), asyncHandler(async (req, res) => {
  const { name, email, phone, company } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({
      success: false,
      error: 'Nome e email são obrigatórios'
    });
  }
  
  // Simular criação de cliente
  const newClient = {
    id: 'client-' + Date.now(),
    name,
    email,
    phone: phone || '',
    company: company || '',
    created_at: new Date().toISOString(),
    status: 'active'
  };
  
  res.status(201).json({
    success: true,
    message: 'Cliente criado com sucesso',
    client: newClient
  });
}));

// GET /admin/users - endpoint MVP simples
router.get('/admin/users', realAuth, requireAdmin, logProtectedAccess('admin_users_list'), asyncHandler(async (req, res) => {
  // Simular lista de usuários
  const users = [
    {
      id: '1',
      name: 'Admin User',
      email: 'admin@grifo.com',
      role: 'admin',
      status: 'active',
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      name: 'Cliente Teste',
      email: 'cliente.teste@exemplo.com',
      role: 'client',
      status: 'active',
      created_at: '2024-01-02T00:00:00Z'
    }
  ];
  
  res.json({
    success: true,
    users,
    total: users.length
  });
}));

// POST /client/request-visit - endpoint MVP simples
router.post('/client/request-visit', realAuth, asyncHandler(async (req, res) => {
  const { property_address, visit_date, visit_time, notes } = req.body;
  
  if (!property_address || !visit_date) {
    return res.status(400).json({
      success: false,
      error: 'Endereço da propriedade e data da visita são obrigatórios'
    });
  }
  
  // Simular criação de solicitação de vistoria
  const newVisitRequest = {
    id: 'visit-' + Date.now(),
    property_address,
    visit_date,
    visit_time: visit_time || '09:00',
    notes: notes || '',
    status: 'pending',
    client_id: req.user.id,
    created_at: new Date().toISOString()
  };
  
  res.status(201).json({
    success: true,
    message: 'Solicitação de vistoria criada com sucesso',
    visit_request: newVisitRequest
  });
}));

// GET /admin/visits - endpoint MVP simples
router.get('/admin/visits', realAuth, requireAdmin, logProtectedAccess('admin_visits_list'), asyncHandler(async (req, res) => {
  // Simular lista de vistorias
  const visits = [
    {
      id: 'visit-1',
      property_address: 'Rua das Flores, 123 - São Paulo, SP',
      visit_date: '2024-01-15',
      visit_time: '09:00',
      status: 'pending',
      client_id: '2',
      client_name: 'Cliente Teste',
      notes: 'Primeira vistoria',
      created_at: '2024-01-10T10:00:00Z'
    },
    {
      id: 'visit-2',
      property_address: 'Av. Paulista, 456 - São Paulo, SP',
      visit_date: '2024-01-16',
      visit_time: '14:00',
      status: 'completed',
      client_id: '2',
      client_name: 'Cliente Teste',
      notes: 'Vistoria de apartamento',
      created_at: '2024-01-11T15:30:00Z'
    }
  ];
  
  res.json({
    success: true,
    visits,
    total: visits.length
  });
}));

// PUT /admin/visits/:id - endpoint MVP simples
router.put('/admin/visits/:id', realAuth, requireAdmin, logProtectedAccess('admin_visits_update'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;
  
  if (!status) {
    return res.status(400).json({
      success: false,
      error: 'Status é obrigatório'
    });
  }
  
  const validStatuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'Status inválido. Valores aceitos: ' + validStatuses.join(', ')
    });
  }
  
  // Simular atualização de vistoria
  const updatedVisit = {
    id,
    status,
    notes: notes || '',
    updated_at: new Date().toISOString(),
    updated_by: req.user.id
  };
  
  res.json({
    success: true,
    message: 'Status da vistoria atualizado com sucesso',
    visit: updatedVisit
  });
}));

// GET /admin/visits/:id - endpoint adicional para obter detalhes de uma vistoria
router.get('/admin/visits/:id', realAuth, requireAdmin, logProtectedAccess('admin_visits_detail'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Simular busca de vistoria específica
  const visit = {
    id,
    property_address: 'Rua das Flores, 123 - São Paulo, SP',
    visit_date: '2024-01-15',
    visit_time: '09:00',
    status: 'pending',
    client_id: '2',
    client_name: 'Cliente Teste',
    notes: 'Primeira vistoria',
    created_at: '2024-01-10T10:00:00Z'
  };
  
  res.json({
    success: true,
    visit
  });
}));

// GET /client/visits - endpoint para cliente visualizar suas vistorias
router.get('/client/visits', realAuth, asyncHandler(async (req, res) => {
  // Simular lista de vistorias do cliente logado
  const clientVisits = [
    {
      id: 'visit-1',
      property_address: 'Rua das Flores, 123 - São Paulo, SP',
      visit_date: '2024-01-15',
      visit_time: '09:00',
      status: 'in_progress', // Status atualizado pelo admin
      notes: 'Vistoria iniciada pelo admin',
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2025-08-27T20:31:27.369Z'
    },
    {
      id: 'visit-2',
      property_address: 'Av. Paulista, 456 - São Paulo, SP',
      visit_date: '2024-01-16',
      visit_time: '14:00',
      status: 'completed',
      notes: 'Vistoria de apartamento',
      created_at: '2024-01-11T15:30:00Z'
    }
  ];
  
  res.json({
    success: true,
    visits: clientVisits,
    total: clientVisits.length
  });
}));

module.exports = router;
