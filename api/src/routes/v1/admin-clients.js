const express = require('express');
const { supabase } = require('../../config/supabase.js');
const { asyncHandler, AppError, ValidationError } = require('../../middleware/errorHandler.js');
const { validateRequest } = require('../../middleware/validation.js');
const { requireRole } = require('../../middleware/auth.js');
// const { logger } = require('../../config/logger.js');
const { z } = require('zod');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Schema de validação para criação de cliente usando Zod
const createClientSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome deve ter no máximo 100 caracteres'),
  email: z.string().email('Email deve ter formato válido').max(255, 'Email deve ter no máximo 255 caracteres'),
  phone: z.string().regex(/^[0-9+\-\s\(\)]{10,20}$/, 'Telefone deve ter formato válido').optional(),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100, 'Senha deve ter no máximo 100 caracteres'),
  document: z.string().min(11, 'Documento deve ter pelo menos 11 caracteres').max(14, 'Documento deve ter no máximo 14 caracteres').optional(),
  address: z.string().max(500, 'Endereço deve ter no máximo 500 caracteres').optional(),
  city: z.string().max(100, 'Cidade deve ter no máximo 100 caracteres').optional(),
  state: z.string().length(2, 'Estado deve ter exatamente 2 caracteres').optional(),
  zip_code: z.string().regex(/^[0-9]{5}-?[0-9]{3}$/, 'CEP deve ter formato válido').optional(),
  tenant_slug: z.string().min(2, 'Tenant deve ter pelo menos 2 caracteres').max(50, 'Tenant deve ter no máximo 50 caracteres')
});

/**
 * @swagger
 * /api/v1/admin/clients:
 *   post:
 *     tags: [Admin - Clients]
 *     summary: Criar novo cliente (apenas administradores)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome completo do cliente
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do cliente
 *               phone:
 *                 type: string
 *                 description: Telefone do cliente
 *               password:
 *                 type: string
 *                 description: Senha do cliente
 *               documento:
 *                 type: string
 *                 description: CPF ou CNPJ do cliente
 *               endereco:
 *                 type: object
 *                 description: Endereço do cliente
 *               tenant:
 *                 type: string
 *                 description: Identificador do tenant
 *     responses:
 *       201:
 *         description: Cliente criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email já cadastrado
 */
router.post(
  '/',
  requireRole(['admin', 'super_admin']),
  validateRequest({ body: createClientSchema }),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const userData = req.user;

    console.log('Admin creating new client', {
      adminId: req.user.id,
      clientEmail: email
    });

    // Verificar se o email já existe na tabela users
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      throw new ValidationError('Email já cadastrado');
    }

    // Verificar se o tenant existe
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', req.body.tenant_slug)
      .single();

    if (!tenantData) {
      throw new ValidationError('Tenant não encontrado');
    }

    // Criar usuário no Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      throw new Error(`Erro ao criar usuário de autenticação: ${authError.message}`);
    }

    // Inserir dados do cliente na tabela users unificada
    const { data: newUserData, error: userError } = await supabase
      .from('users')
      .insert({
        auth_user_id: authUser.user.id,
        name,
        email,
        phone: req.body.phone || null,
        document: req.body.document || null,
        address: req.body.address || null,
        city: req.body.city || null,
        state: req.body.state || null,
        zip_code: req.body.zip_code || null,
        tenant_id: tenantData.id,
        tenant_slug: req.body.tenant_slug,
        user_type: 'client',
        status: 'active',
        is_active: true
      })
      .select()
      .single();

    if (userError) {
      // Se falhou ao criar usuário, remover usuário de autenticação
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw new Error(`Erro ao criar usuário: ${userError.message}`);
    }

    // Retornar dados do usuário criado com link do portal cliente
    const clientPortalLink = `${process.env.CLIENT_PORTAL_URL || 'http://localhost:5173'}/${req.body.tenant_slug}`;
    
    res.status(201).json({
      success: true,
      data: {
        id: newUserData.id,
        name: newUserData.name,
        email: newUserData.email,
        phone: newUserData.phone,
        tenant_id: newUserData.tenant_id,
        tenant_slug: newUserData.tenant_slug,
        user_type: newUserData.user_type,
        status: newUserData.status,
        created_at: newUserData.created_at,
        clientPortalLink
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/admin/clients:
 *   get:
 *     tags: [Admin - Clients]
 *     summary: Listar todos os clientes (apenas administradores)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: tenant
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Lista de clientes
 */
router.get(
  '/',
  requireRole(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 20,
      search = '',
      tenant_slug = '',
      status = '',
      user_type = 'client'
    } = req.query;

    const offset = (page - 1) * limit;
    let query = supabase
      .from('users')
      .select(`
        id,
        name,
        email,
        phone,
        document,
        address,
        city,
        state,
        zip_code,
        tenant_id,
        tenant_slug,
        user_type,
        status,
        is_active,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('user_type', user_type)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtros
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (tenant_slug) {
      query = query.eq('tenant_slug', tenant_slug);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      throw new AppError('Erro ao buscar usuários', 500);
    }

    // Remover dados sensíveis
    const sanitizedUsers = users.map(user => {
      const { password_hash, auth_user_id, ...sanitizedUser } = user;
      return sanitizedUser;
    });

    res.json({
      success: true,
      data: sanitizedUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  })
);

module.exports = router;

