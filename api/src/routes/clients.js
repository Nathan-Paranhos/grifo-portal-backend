const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { supabase } = require('../config/supabase.js');
// const { logger, authLogger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const {
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError
} = require('../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../middleware/validation.js');

const router = express.Router();

// Client validation schemas
const clientSchemas = {
  register: {
    body: z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      email: commonSchemas.email,
      phone: z.string().optional(),
      document: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip_code: z.string().optional(),
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
    })
  },
  login: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(1, 'Senha é obrigatória')
    })
  },
  update: {
    body: z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      document: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      zip_code: z.string().optional()
    })
  }
};

// Client authentication middleware
const authenticateClient = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new AuthenticationError('Token de acesso requerido');
  }

  // Verificar se é um token de cliente
  const { data: session, error } = await supabase
    .from('client_sessions')
    .select('client_id, expires_at')
    .eq('session_token', token)
    .single();

  if (error || !session) {
    console.log('Client authentication failed - invalid token', {
      token: token.substring(0, 10) + '...',
      ip: req.ip
    });
    throw new AuthenticationError('Token inválido');
  }

  // Verificar se a sessão não expirou
  if (new Date(session.expires_at) < new Date()) {
    await supabase
      .from('client_sessions')
      .delete()
      .eq('session_token', token);
    
    console.log('Client session expired', {
      clientId: session.client_id,
      ip: req.ip
    });
    throw new AuthenticationError('Sessão expirada');
  }

  // Atualizar última atividade
  await supabase
    .from('client_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_token', token);

  req.clientId = session.client_id;
  next();
});

/**
 * @swagger
 * /api/v1/clients/register:
 *   post:
 *     tags: [Clients]
 *     summary: Registrar novo cliente
 *     description: Cria uma nova conta de cliente no sistema
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               phone:
 *                 type: string
 *               document:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zip_code:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cliente registrado com sucesso
 *       400:
 *         description: Dados inválidos ou email já cadastrado
 */
router.post(
  '/register',
  validateRequest(clientSchemas.register),
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, document, address, city, state, zip_code } = req.body;

    // Verificar se o email já existe
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingClient) {
      throw new ValidationError('Email já cadastrado');
    }

    // Hash da senha
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Criar cliente
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name,
        email: email.toLowerCase(),
        phone,
        document,
        address,
        city,
        state,
        zip_code,
        password_hash: passwordHash,
        status: 'active'
      })
      .select('id, name, email, phone, document, address, city, state, zip_code, status, created_at')
      .single();

    if (error) {
      console.error('Error creating client', { error, email });
      throw new AppError('Erro ao criar cliente', 500);
    }

    // Log de auditoria
    console.log('Client registered successfully', {
      clientId: client.id,
      email: client.email,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Cliente registrado com sucesso',
      data: {
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          phone: client.phone,
          status: client.status,
          created_at: client.created_at
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/clients/login:
 *   post:
 *     tags: [Clients]
 *     summary: Login de cliente
 *     description: Autentica um cliente e retorna um token de sessão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais inválidas ou conta desativada
 */
router.post(
  '/login',
  validateRequest(clientSchemas.login),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Buscar cliente
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, email, password_hash, status')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !client) {
      console.log('Client login failed - user not found', {
      email,
      ip: req.ip
    });
      throw new AuthenticationError('Credenciais inválidas');
    }

    // Verificar se o cliente está ativo
    if (client.status !== 'active') {
      console.log('Client login failed - account inactive', {
        email,
        clientId: client.id,
        status: client.status,
        ip: req.ip
      });
      throw new AuthenticationError('Conta desativada');
    }

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, client.password_hash);
    if (!isValidPassword) {
      console.log('Client login failed - invalid password', {
        email,
        clientId: client.id,
        ip: req.ip
      });
      throw new AuthenticationError('Credenciais inválidas');
    }

    // Gerar token de sessão
    const sessionToken = jwt.sign(
      { clientId: client.id, type: 'client' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Criar sessão no banco
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias

    const { error: sessionError } = await supabase
      .from('client_sessions')
      .insert({
        client_id: client.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      });

    if (sessionError) {
      console.error('Error creating client session', {
        error: sessionError,
        clientId: client.id
      });
      throw new AppError('Erro ao criar sessão', 500);
    }

    // Log de auditoria
    console.log('Client logged in successfully', {
      clientId: client.id,
      email: client.email,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        token: sessionToken,
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          status: client.status
        },
        expiresIn: '7d'
      }
    });
  })
);

// Logout do cliente
router.post(
  '/logout',
  authenticateClient,
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      // Remover sessão do banco
      await supabase
        .from('client_sessions')
        .delete()
        .eq('session_token', token);

      console.log('Client logged out', {
      clientId: req.clientId,
      ip: req.ip
    });
    }

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  })
);

// Obter perfil do cliente
router.get(
  '/profile',
  authenticateClient,
  asyncHandler(async (req, res) => {
    const { data: client, error } = await supabase
      .from('clients')
      .select('id, name, email, phone, document, address, city, state, zip_code, status, created_at, updated_at')
      .eq('id', req.clientId)
      .single();

    if (error || !client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    res.json({
      success: true,
      data: { client }
    });
  })
);

// Atualizar perfil do cliente
router.put(
  '/profile',
  authenticateClient,
  validateRequest(clientSchemas.update),
  asyncHandler(async (req, res) => {
    const updateData = req.body;
    updateData.updated_at = new Date().toISOString();

    const { data: client, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', req.clientId)
      .select('id, name, email, phone, document, address, city, state, zip_code, status, updated_at')
      .single();

    if (error) {
      console.error('Error updating client profile', {
        error,
        clientId: req.clientId
      });
      throw new AppError('Erro ao atualizar perfil', 500);
    }

    console.log('Client profile updated', {
      clientId: req.clientId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Perfil atualizado com sucesso',
      data: { client }
    });
  })
);

// ROTAS ADMINISTRATIVAS (requerem autenticação de usuário do sistema)

// Listar todos os clientes (admin)
router.get(
  '/',
  // authMiddleware, // Descomente quando implementar auth de admin
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const status = req.query.status;
    const search = req.query.search;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('clients')
      .select('id, name, email, phone, document, city, state, is_active, created_at', { count: 'exact' });

    if (status) {
      const isActive = status === 'active';
      query = query.eq('is_active', isActive);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data: clients, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error listing clients - DETAILED ERROR:', {
        error,
        errorCode: error?.code,
        errorMessage: error?.message,
        errorDetails: error?.details,
        errorHint: error?.hint
      });
      throw new AppError('Erro ao listar clientes', 500);
    }

    res.json({
      success: true,
      data: {
        clients,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });
  })
);

// Obter cliente específico (admin)
router.get(
  '/:id',
  // authMiddleware, // Descomente quando implementar auth de admin
  asyncHandler(async (req, res) => {
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !client) {
      throw new AppError('Cliente não encontrado', 404);
    }

    // Remover senha do retorno
    delete client.password_hash;

    res.json({
      success: true,
      data: { client }
    });
  })
);

// Atualizar status do cliente (admin)
router.patch(
  '/:id/status',
  // authMiddleware, // Descomente quando implementar auth de admin
  validateRequest({
    body: z.object({
      status: z.enum(['active', 'inactive', 'suspended'])
    })
  }),
  asyncHandler(async (req, res) => {
    const { status } = req.body;
    const isActive = status === 'active';

    const { data: client, error } = await supabase
      .from('clients')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select('id, name, email, is_active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new AppError('Cliente não encontrado', 404);
      }
      console.error('Error updating client status', { error, clientId: req.params.id });
      throw new AppError('Erro ao atualizar status', 500);
    }

    // Se desativando, remover todas as sessões ativas
    if (!isActive) {
      await supabase
        .from('client_sessions')
        .delete()
        .eq('client_id', req.params.id);
    }

    console.log('Client status updated', {
      clientId: req.params.id,
      newStatus: status,
      // adminId: req.user?.id // Descomente quando implementar auth de admin
    });

    res.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: { client }
    });
  })
);

// Deletar cliente (admin)
router.delete(
  '/:id',
  // authMiddleware, // Descomente quando implementar auth de admin
  asyncHandler(async (req, res) => {
    // Verificar se cliente existe
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', req.params.id)
      .single();

    if (!existingClient) {
      throw new AppError('Cliente não encontrado', 404);
    }

    // Remover sessões ativas
    await supabase
      .from('client_sessions')
      .delete()
      .eq('client_id', req.params.id);

    // Deletar cliente
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      console.error('Error deleting client', { error, clientId: req.params.id });
      throw new AppError('Erro ao deletar cliente', 500);
    }

    console.log('Client deleted', {
      clientId: req.params.id,
      clientName: existingClient.name,
      clientEmail: existingClient.email,
      // adminId: req.user?.id // Descomente quando implementar auth de admin
    });

    res.json({
      success: true,
      message: 'Cliente deletado com sucesso'
    });
  })
);

module.exports = router;
