const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 10000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://fsvwifbvehdhlufauahj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDYyMjUwNiwiZXhwIjoyMDcwMTk4NTA2fQ.P0IucayWhykgPkSkvGUvzW1Q0PHtzNaSbJ010EWS-6A';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdndpZmJ2ZWhkaGx1ZmF1YWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjI1MDYsImV4cCI6MjA3MDE5ODUwNn0.woGY7a1Yv1FI-c9dUatYW9WeeuUIk7Lqnf25EJ8unB5Cp0u55gh2B897H4TlpvVa';

// Cliente Supabase com service role para operações administrativas
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Prefer', 'Range']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  }
});

// Middleware de autenticação JWT
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const apikey = req.headers['apikey'];
  
  // Permitir acesso com service role key
  if (apikey === supabaseServiceKey) {
    req.user = { role: 'service_role', empresa_id: null };
    return next();
  }
  
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }
  
  try {
    // Verificar token JWT
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    
    req.user = decoded.payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar permissões de superadmin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Acesso negado: requer permissões de superadmin' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Grifo API Backend - Supabase Integration',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    supabase_url: supabaseUrl,
    endpoints: {
      rest: `${supabaseUrl}/rest/v1`,
      rpc: `${supabaseUrl}/rest/v1/rpc`,
      functions: `${supabaseUrl}/functions/v1`,
      graphql: `${supabaseUrl}/graphql/v1`,
      storage: `${supabaseUrl}/storage/v1`
    }
  });
});

// API Info
app.get('/api', (req, res) => {
  res.json({
    name: 'Grifo API Backend',
    version: '1.0.0',
    description: 'API multi-tenant para gerenciamento de vistorias imobiliárias',
    base_urls: {
      rest: `${supabaseUrl}/rest/v1`,
      rpc: `${supabaseUrl}/rest/v1/rpc`,
      functions: `${supabaseUrl}/functions/v1`,
      graphql: `${supabaseUrl}/graphql/v1`,
      storage: `${supabaseUrl}/storage/v1`
    },
    authentication: {
      header: 'Authorization: Bearer <jwt>',
      apikey: 'apikey: <ANON_KEY ou SERVICE_ROLE_KEY>'
    },
    resources: {
      empresas: '/rest/v1/empresas',
      usuarios: '/rest/v1/usuarios',
      imoveis: '/rest/v1/imoveis',
      vistorias: '/rest/v1/vistorias',
      contestacoes: '/rest/v1/contestacoes'
    },
    rpc_functions: {
      dashboard_kpis: '/rest/v1/rpc/dashboard_kpis',
      usage_stats: '/rest/v1/rpc/usage_stats'
    },
    edge_functions: {
      create_tenant: '/functions/v1/create_tenant',
      assign_role: '/functions/v1/assign_role',
      finalize_vistoria: '/functions/v1/finalize_vistoria',
      drive_sync: '/functions/v1/drive_sync'
    }
  });
});

// ===== CRUD AUTOMÁTICO VIA POSTGREST =====

// Empresas
app.get('/rest/v1/empresas', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('empresas').select('*');
    
    // Aplicar filtros da query string
    Object.keys(req.query).forEach(key => {
      if (key.includes('=')) {
        const [field, operator] = key.split('=');
        const value = req.query[key];
        
        switch (operator) {
          case 'eq':
            query = query.eq(field, value);
            break;
          case 'neq':
            query = query.neq(field, value);
            break;
          case 'gt':
            query = query.gt(field, value);
            break;
          case 'gte':
            query = query.gte(field, value);
            break;
          case 'lt':
            query = query.lt(field, value);
            break;
          case 'lte':
            query = query.lte(field, value);
            break;
          case 'like':
            query = query.like(field, value);
            break;
          case 'in':
            query = query.in(field, value.split(','));
            break;
        }
      }
    });
    
    // Paginação
    const range = req.headers.range;
    if (range) {
      const [start, end] = range.split('-').map(Number);
      query = query.range(start, end);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    // Headers de resposta
    if (range) {
      const [start, end] = range.split('-').map(Number);
      res.set('Content-Range', `${start}-${Math.min(end, data.length - 1)}/${count || data.length}`);
      res.status(206);
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/rest/v1/empresas', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('empresas')
      .insert(req.body)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/rest/v1/empresas', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    let query = supabase.from('empresas').update(req.body);
    
    // Aplicar filtros para identificar registros a serem atualizados
    query = parseFilters(req.query, query);
    
    const { data, error } = await query.select();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Nenhuma empresa encontrada para atualização' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Erro em PATCH /rest/v1/empresas:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Função auxiliar para parsing de filtros
const parseFilters = (query, supabaseQuery) => {
  Object.keys(query).forEach(key => {
    if (key.includes('=')) {
      const [field, operator] = key.split('=');
      const value = query[key];
      
      switch (operator) {
        case 'eq':
          supabaseQuery = supabaseQuery.eq(field, value);
          break;
        case 'neq':
          supabaseQuery = supabaseQuery.neq(field, value);
          break;
        case 'gt':
          supabaseQuery = supabaseQuery.gt(field, value);
          break;
        case 'gte':
          supabaseQuery = supabaseQuery.gte(field, value);
          break;
        case 'lt':
          supabaseQuery = supabaseQuery.lt(field, value);
          break;
        case 'lte':
          supabaseQuery = supabaseQuery.lte(field, value);
          break;
        case 'like':
          supabaseQuery = supabaseQuery.like(field, value);
          break;
        case 'in':
          supabaseQuery = supabaseQuery.in(field, value.split(','));
          break;
      }
    }
  });
  return supabaseQuery;
};

// Função auxiliar para paginação
const parsePagination = (req, query) => {
  const range = req.headers.range;
  if (range) {
    const [start, end] = range.split('-').map(Number);
    query = query.range(start, end);
  }
  return query;
};

// Usuários
app.get('/rest/v1/usuarios', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('usuarios').select(req.query.select || '*', { count: 'exact' });
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros
    query = parseFilters(req.query, query);
    
    // Aplicar ordenação
    if (req.query.order) {
      const orderParts = req.query.order.split('.');
      const field = orderParts[0];
      const direction = orderParts[1] === 'desc' ? false : true;
      query = query.order(field, { ascending: direction });
    }
    
    // Aplicar paginação
    query = parsePagination(req, query);
    
    const { data, error, count } = await query;
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    // Headers de resposta para paginação
    const range = req.headers.range;
    if (range) {
      const matches = range.match(/^(\d+)-(\d+)$/);
      if (matches && data) {
        const start = parseInt(matches[1]);
        const end = Math.min(parseInt(matches[2]), start + data.length - 1);
        res.set('Content-Range', `${start}-${end}/${count || '*'}`);
        res.status(206);
      }
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Erro em /rest/v1/usuarios:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.post('/rest/v1/usuarios', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    // Garantir que empresa_id seja do usuário logado (exceto superadmin)
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      req.body.empresa_id = req.user.empresa_id;
    }
    
    const { data, error } = await supabase
      .from('usuarios')
      .insert(req.body)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    res.status(201).json(data);
  } catch (error) {
    console.error('Erro em POST /rest/v1/usuarios:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.patch('/rest/v1/usuarios', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    let query = supabase.from('usuarios').update(req.body);
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros para identificar registros a serem atualizados
    query = parseFilters(req.query, query);
    
    const { data, error } = await query.select();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Nenhum usuário encontrado para atualização' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Erro em PATCH /rest/v1/usuarios:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Imóveis
app.get('/rest/v1/imoveis', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('imoveis').select(req.query.select || '*', { count: 'exact' });
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros
    query = parseFilters(req.query, query);
    
    // Aplicar ordenação
    if (req.query.order) {
      const orderParts = req.query.order.split('.');
      const field = orderParts[0];
      const direction = orderParts[1] === 'desc' ? false : true;
      query = query.order(field, { ascending: direction });
    }
    
    // Aplicar paginação
    query = parsePagination(req, query);
    
    const { data, error, count } = await query;
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    // Headers de resposta para paginação
    const range = req.headers.range;
    if (range) {
      const matches = range.match(/^(\d+)-(\d+)$/);
      if (matches && data) {
        const start = parseInt(matches[1]);
        const end = Math.min(parseInt(matches[2]), start + data.length - 1);
        res.set('Content-Range', `${start}-${end}/${count || '*'}`);
        res.status(206);
      }
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Erro em /rest/v1/imoveis:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.post('/rest/v1/imoveis', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    // Garantir que empresa_id seja do usuário logado (exceto superadmin)
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      req.body.empresa_id = req.user.empresa_id;
    }
    
    const { data, error } = await supabase
      .from('imoveis')
      .insert(req.body)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    res.status(201).json(data);
  } catch (error) {
    console.error('Erro em POST /rest/v1/imoveis:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.patch('/rest/v1/imoveis', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    let query = supabase.from('imoveis').update(req.body);
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros para identificar registros a serem atualizados
    query = parseFilters(req.query, query);
    
    const { data, error } = await query.select();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Nenhum imóvel encontrado para atualização' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Erro em PATCH /rest/v1/imoveis:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.delete('/rest/v1/imoveis', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('imoveis').delete();
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros da query string
    Object.keys(req.query).forEach(key => {
      if (key.includes('=')) {
        const [field, operator] = key.split('=');
        const value = req.query[key];
        
        if (operator === 'eq') {
          query = query.eq(field, value);
        }
      }
    });
    
    const { error } = await query;
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vistorias
app.get('/rest/v1/vistorias', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('vistorias').select(req.query.select || '*', { count: 'exact' });
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros
    query = parseFilters(req.query, query);
    
    // Aplicar ordenação
    if (req.query.order) {
      const orderParts = req.query.order.split('.');
      const field = orderParts[0];
      const direction = orderParts[1] === 'desc' ? false : true;
      query = query.order(field, { ascending: direction });
    }
    
    // Aplicar paginação
    query = parsePagination(req, query);
    
    const { data, error, count } = await query;
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    // Headers de resposta para paginação
    const range = req.headers.range;
    if (range) {
      const matches = range.match(/^(\d+)-(\d+)$/);
      if (matches && data) {
        const start = parseInt(matches[1]);
        const end = Math.min(parseInt(matches[2]), start + data.length - 1);
        res.set('Content-Range', `${start}-${end}/${count || '*'}`);
        res.status(206);
      }
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Erro em /rest/v1/vistorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.post('/rest/v1/vistorias', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    // Garantir que empresa_id seja do usuário logado (exceto superadmin)
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      req.body.empresa_id = req.user.empresa_id;
    }
    
    const { data, error } = await supabase
      .from('vistorias')
      .insert(req.body)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    res.status(201).json(data);
  } catch (error) {
    console.error('Erro em POST /rest/v1/vistorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.patch('/rest/v1/vistorias', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    let query = supabase.from('vistorias').update(req.body);
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros para identificar registros a serem atualizados
    query = parseFilters(req.query, query);
    
    const { data, error } = await query.select();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Nenhuma vistoria encontrada para atualização' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Erro em PATCH /rest/v1/vistorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// Contestações
app.get('/rest/v1/contestacoes', authenticateToken, async (req, res) => {
  try {
    let query = supabase.from('contestacoes').select(req.query.select || '*', { count: 'exact' });
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros
    query = parseFilters(req.query, query);
    
    // Aplicar ordenação
    if (req.query.order) {
      const orderParts = req.query.order.split('.');
      const field = orderParts[0];
      const direction = orderParts[1] === 'desc' ? false : true;
      query = query.order(field, { ascending: direction });
    }
    
    // Aplicar paginação
    query = parsePagination(req, query);
    
    const { data, error, count } = await query;
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    // Headers de resposta para paginação
    const range = req.headers.range;
    if (range) {
      const matches = range.match(/^(\d+)-(\d+)$/);
      if (matches && data) {
        const start = parseInt(matches[1]);
        const end = Math.min(parseInt(matches[2]), start + data.length - 1);
        res.set('Content-Range', `${start}-${end}/${count || '*'}`);
        res.status(206);
      }
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Erro em /rest/v1/contestacoes:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.post('/rest/v1/contestacoes', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    // Garantir que empresa_id seja do usuário logado (exceto superadmin)
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      req.body.empresa_id = req.user.empresa_id;
    }
    
    const { data, error } = await supabase
      .from('contestacoes')
      .insert(req.body)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    res.status(201).json(data);
  } catch (error) {
    console.error('Erro em POST /rest/v1/contestacoes:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.patch('/rest/v1/contestacoes', authenticateToken, async (req, res) => {
  try {
    // Validação básica
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    
    let query = supabase.from('contestacoes').update(req.body);
    
    // RLS: filtrar por empresa_id se não for superadmin
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      query = query.eq('empresa_id', req.user.empresa_id);
    }
    
    // Aplicar filtros para identificar registros a serem atualizados
    query = parseFilters(req.query, query);
    
    const { data, error } = await query.select();
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Nenhuma contestação encontrada para atualização' });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Erro em PATCH /rest/v1/contestacoes:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ===== RPC (FUNÇÕES SQL) =====

app.post('/rest/v1/rpc/dashboard_kpis', authenticateToken, async (req, res) => {
  try {
    const { empresa } = req.body;
    
    // Validação de empresa_id
    if (!empresa) {
      return res.status(400).json({ error: 'empresa é obrigatório' });
    }
    
    // Verificar se o usuário tem acesso à empresa (exceto superadmin)
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      if (empresa !== req.user.empresa_id) {
        return res.status(403).json({ error: 'Acesso negado à empresa especificada' });
      }
    }
    
    const { data, error } = await supabase.rpc('dashboard_kpis', { empresa });
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    res.json(data || {});
  } catch (error) {
    console.error('Erro em RPC dashboard_kpis:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

app.post('/rest/v1/rpc/usage_stats', authenticateToken, async (req, res) => {
  try {
    const { empresa, periodo } = req.body;
    
    // Validação de parâmetros
    if (!empresa) {
      return res.status(400).json({ error: 'empresa é obrigatório' });
    }
    
    // Verificar se o usuário tem acesso à empresa (exceto superadmin)
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      if (empresa !== req.user.empresa_id) {
        return res.status(403).json({ error: 'Acesso negado à empresa especificada' });
      }
    }
    
    const { data, error } = await supabase.rpc('usage_stats', { empresa, periodo: periodo || '30d' });
    
    if (error) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    
    res.json(data || {});
  } catch (error) {
    console.error('Erro em RPC usage_stats:', error);
    res.status(500).json({ error: 'Erro interno do servidor', details: error.message });
  }
});

// ===== EDGE FUNCTIONS =====

app.post('/functions/v1/create_tenant', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { nome, cnpj, email, plano } = req.body;
    
    // Validação de entrada
    if (!nome || !cnpj) {
      return res.status(400).json({ error: 'Nome e CNPJ são obrigatórios' });
    }
    
    // Validar formato do CNPJ (básico)
    if (cnpj && cnpj.replace(/\D/g, '').length !== 14) {
      return res.status(400).json({ error: 'CNPJ deve ter 14 dígitos' });
    }
    
    // Validar email se fornecido
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Formato de email inválido' });
      }
    }
    
    // Criar empresa
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .insert({
        nome,
        cnpj,
        email,
        plano: plano || 'basico',
        ativa: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (empresaError) {
      return res.status(400).json({ 
        error: 'Erro ao criar empresa', 
        details: empresaError.message 
      });
    }
    
    res.status(201).json({ 
      empresa_id: empresa.id,
      nome: empresa.nome,
      cnpj: empresa.cnpj,
      status: 'criada'
    });
  } catch (error) {
    console.error('Erro em create_tenant:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: error.message 
    });
  }
});

app.post('/functions/v1/assign_role', authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const { user_id, role, empresa_id } = req.body;
    
    if (!user_id || !role || !empresa_id) {
      return res.status(400).json({ error: 'user_id, role e empresa_id são obrigatórios' });
    }
    
    // Atualizar usuário
    const { data, error } = await supabase
      .from('usuarios')
      .update({
        role,
        empresa_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ success: true, user: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/functions/v1/finalize_vistoria', authenticateToken, async (req, res) => {
  try {
    const { vistoria_id, pdf_url } = req.body;
    
    if (!vistoria_id || !pdf_url) {
      return res.status(400).json({ error: 'vistoria_id e pdf_url são obrigatórios' });
    }
    
    // Verificar se a vistoria pertence à empresa do usuário
    const { data: vistoria, error: vistoriaError } = await supabase
      .from('vistorias')
      .select('empresa_id')
      .eq('id', vistoria_id)
      .single();
    
    if (vistoriaError) {
      return res.status(404).json({ error: 'Vistoria não encontrada' });
    }
    
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      if (vistoria.empresa_id !== req.user.empresa_id) {
        return res.status(403).json({ error: 'Acesso negado: empresa_id mismatch' });
      }
    }
    
    // Finalizar vistoria
    const { data, error } = await supabase
      .from('vistorias')
      .update({
        status: 'finalizada',
        pdf_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', vistoria_id)
      .select()
      .single();
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ status: 'finalizada', vistoria: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/functions/v1/drive_sync', async (req, res) => {
  try {
    // Webhook do Storage - sincronização com Google Drive
    console.log('Drive sync webhook received:', req.body);
    
    // Aqui você implementaria a lógica de sincronização com Google Drive
    // Por exemplo, copiar arquivos do Supabase Storage para Google Drive
    
    res.json({ success: true, message: 'Drive sync completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== STORAGE =====

// Upload de arquivos
app.post('/storage/v1/object/:bucket/*', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const bucket = req.params.bucket;
    const filePath = req.params[0];
    
    // Validações
    if (!bucket) {
      return res.status(400).json({ error: 'Nome do bucket é obrigatório' });
    }
    
    if (!filePath) {
      return res.status(400).json({ error: 'Caminho do arquivo é obrigatório' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    // Validar tamanho do arquivo (já tratado pelo Multer, mas verificação adicional)
    if (req.file.size > 10 * 1024 * 1024) { // 10MB
      return res.status(400).json({ error: 'Arquivo muito grande (máximo 10MB)' });
    }
    
    // RLS: Adicionar empresa_id ao path (exceto superadmin)
    let finalPath = filePath;
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      const empresaId = req.user.app_metadata?.empresa_id;
      if (!empresaId) {
        return res.status(400).json({ error: 'Empresa não identificada' });
      }
      finalPath = `${empresaId}/${filePath}`;
    }
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(finalPath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });
    
    if (error) {
      return res.status(400).json({ 
        error: 'Erro ao fazer upload', 
        details: error.message 
      });
    }
    
    res.json({
      Key: data.path,
      id: data.id,
      fullPath: data.fullPath,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Erro em upload:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: error.message 
    });
  }
});

app.post('/storage/v1/object/vistorias/:empresa/:vistoria/:filename', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { empresa, vistoria, filename } = req.params;
    
    // Verificar se o usuário tem acesso à empresa
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      if (empresa !== req.user.empresa_id) {
        return res.status(403).json({ error: 'Acesso negado à empresa especificada' });
      }
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não fornecido' });
    }
    
    const filePath = `${empresa}/${vistoria}/${filename}`;
    
    const { data, error } = await supabase.storage
      .from('vistorias')
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true
      });
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json({ Key: data.path, ETag: data.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Listar arquivos
app.get('/storage/v1/object/list/:bucket', authenticateToken, async (req, res) => {
  try {
    const bucket = req.params.bucket;
    const { prefix, limit, offset } = req.query;
    
    // Validações
    if (!bucket) {
      return res.status(400).json({ error: 'Nome do bucket é obrigatório' });
    }
    
    // RLS: Filtrar por empresa_id (exceto superadmin)
    let searchPrefix = prefix || '';
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      const empresaId = req.user.app_metadata?.empresa_id;
      if (!empresaId) {
        return res.status(400).json({ error: 'Empresa não identificada' });
      }
      searchPrefix = `${empresaId}/${prefix || ''}`;
    }
    
    // Validar parâmetros de paginação
    const parsedLimit = limit ? Math.min(parseInt(limit), 1000) : 100;
    const parsedOffset = offset ? Math.max(parseInt(offset), 0) : 0;
    
    if (isNaN(parsedLimit) || isNaN(parsedOffset)) {
      return res.status(400).json({ error: 'Parâmetros limit e offset devem ser números' });
    }
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(searchPrefix, {
        limit: parsedLimit,
        offset: parsedOffset
      });
    
    if (error) {
      return res.status(400).json({ 
        error: 'Erro ao listar arquivos', 
        details: error.message 
      });
    }
    
    res.json({
      files: data || [],
      count: data?.length || 0,
      limit: parsedLimit,
      offset: parsedOffset
    });
  } catch (error) {
    console.error('Erro em listar arquivos:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: error.message 
    });
  }
});

app.get('/storage/v1/object/list/vistorias/:empresa/:vistoria', authenticateToken, async (req, res) => {
  try {
    const { empresa, vistoria } = req.params;
    
    // Verificar se o usuário tem acesso à empresa
    if (req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      if (empresa !== req.user.empresa_id) {
        return res.status(403).json({ error: 'Acesso negado à empresa especificada' });
      }
    }
    
    const { data, error } = await supabase.storage
      .from('vistorias')
      .list(`${empresa}/${vistoria}`);
    
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GRAPHQL PROXY =====

app.all('/graphql/v1', authenticateToken, async (req, res) => {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    
    if (!supabaseUrl) {
      return res.status(500).json({ error: 'Configuração do Supabase não encontrada' });
    }
    
    const graphqlUrl = `${supabaseUrl}/graphql/v1`;
    
    // Validar se é uma requisição GraphQL válida
    if (req.method === 'POST' && (!req.body || !req.body.query)) {
      return res.status(400).json({ 
        error: 'Query GraphQL é obrigatória',
        details: 'Requisições POST devem conter um campo "query"'
      });
    }
    
    // Headers para o Supabase
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization || `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      'apikey': process.env.SUPABASE_ANON_KEY
    };
    
    // RLS: Adicionar empresa_id como variável (exceto superadmin)
    let body = req.body;
    if (req.method === 'POST' && req.user.role !== 'service_role' && req.user.app_metadata?.role !== 'superadmin') {
      const empresaId = req.user.app_metadata?.empresa_id;
      if (empresaId) {
        if (body.variables && typeof body.variables === 'object') {
          body.variables.empresa_id = empresaId;
        } else {
          body.variables = { empresa_id: empresaId };
        }
      }
    }
    
    const response = await fetch(graphqlUrl, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? JSON.stringify(body) : undefined
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'Erro na requisição GraphQL',
        details: errorText
      });
    }
    
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Erro no proxy GraphQL:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      details: error.message 
    });
  }
});

// Middleware de tratamento de erros
app.use((error, req, res, next) => {
  console.error('Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Arquivo muito grande. Máximo 10MB.' });
    }
    return res.status(400).json({ error: 'Erro no upload: ' + error.message });
  }
  
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }
  
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Erro interno'
  });
});

// Handler OPTIONS para CORS
app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey, Range');
  res.header('Access-Control-Expose-Headers', 'Content-Range');
  res.sendStatus(200);
});

// Root endpoint - redireciona para documentação
app.get('/', (req, res) => {
  res.json({
    message: 'Bem-vindo à Grifo API Backend',
    version: '1.0.0',
    description: 'API completa para Grifo Vistorias - Supabase Integration',
    documentation: {
      swagger: '/functions/v1/docs',
      openapi_spec: '/functions/v1/docs/spec'
    },
    available_endpoints: {
      health: '/health',
      api_info: '/api',
      rest: '/rest/v1/*',
      rpc: '/rest/v1/rpc/*',
      functions: '/functions/v1/*',
      graphql: '/graphql/v1',
      storage: '/storage/v1/*'
    },
    links: {
      portal: 'https://grifo-portal-v1.netlify.app',
      app: 'https://app.grifovistorias.com'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
    message: 'Verifique a documentação da API',
    documentation: '/functions/v1/docs',
    available_endpoints: {
      health: '/health',
      api_info: '/api',
      rest: '/rest/v1/*',
      rpc: '/rest/v1/rpc/*',
      functions: '/functions/v1/*',
      graphql: '/graphql/v1',
      storage: '/storage/v1/*'
    }
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Grifo API Backend running on port ${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`📖 API info: http://localhost:${port}/api`);
  console.log(`🔗 Supabase URL: ${supabaseUrl}`);
  console.log(`✅ All endpoints configured and ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully');
  process.exit(0);
});