const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase.js');
// const { logger, authLogger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const {
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError
} = require('../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../middleware/validation.js');
const { z } = require('zod');
const authModule = require('../middleware/auth.js');
const { verifyAdminCredentials, updateLastLogin } = require('../utils/adminAuth.js');
const { logAdminAccess, logResourceAccess } = require('../utils/auditLogger.js');

// Auth validation schemas
const authSchemas = {
  login: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
      remember: z.boolean().optional().default(false)
    })
  },
  adminLogin: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
      remember: z.boolean().optional().default(false),
      adminCode: z.string().optional() // Optional additional security code
    })
  },
  register: {
    body: z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
      role: z.enum(['admin', 'manager', 'inspector']),
      phone: z.string().optional(),
      department: z.string().optional()
    })
  },
  changePassword: {
    body: z
      .object({
        current_password: z.string().min(1, 'Senha atual é obrigatória'),
        new_password: z
          .string()
          .min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
        confirm_password: z
          .string()
          .min(1, 'Confirmação de senha é obrigatória')
      })
      .refine(data => data.new_password === data.confirm_password, {
        message: 'Senhas não coincidem',
        path: ['confirm_password']
      })
  },
  forgotPassword: {
    body: z.object({
      email: commonSchemas.email
    })
  },
  resetPassword: {
    body: z
      .object({
        token: z.string().min(1, 'Token é obrigatório'),
        password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
        confirm_password: z
          .string()
          .min(1, 'Confirmação de senha é obrigatória')
      })
      .refine(data => data.password === data.confirm_password, {
        message: 'Senhas não coincidem',
        path: ['confirm_password']
      })
  }
};
const { authMiddleware, optionalAuth } = authModule;

const router = express.Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login de usuário
 *     description: |
 *       Autentica um usuário com email e senha.
 *       Retorna um token JWT válido por 24 horas.
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
 *                 example: "usuario@exemplo.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "senha123"
 *               remember:
 *                 type: boolean
 *                 description: Se true, token expira em 30 dias
 *                 example: false
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login realizado com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     expiresIn:
 *                       type: string
 *                       example: "24h"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/login',
  validateRequest(authSchemas.login),
  asyncHandler(async (req, res) => {
    const { email, password, remember = false } = req.body;

    // Login attempt logged for production
    console.log('Login attempt', { email, ip: req.ip, userAgent: req.get('User-Agent') });

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(
        `
        id,
        email,
        password_hash,
        name,
        role,
        user_type,
        status,
        is_active,
        company_id,
        last_login,
        first_login_completed,
        password_changed_at,
        empresas!inner(
          id,
          name,
          status
        )
      `
      )
      .eq('email', email.toLowerCase())
      .eq('status', 'active')
      .single();

    if (userError || !user) {
      console.log('Login failed - user not found', { email, ip: req.ip });
      await logAdminAccess(email, null, 'login_failed', 'user_not_found', req.ip, req.get('User-Agent'));
      throw new AuthenticationError('Credenciais inválidas');
    }

    // Check if company is active
    if (user.empresas.status !== 'active') {
      console.log('Login failed - company inactive', {
        email,
        companyId: user.company_id,
        ip: req.ip
      });
      await logAdminAccess(email, user.id, 'login_failed', 'company_inactive', req.ip, req.get('User-Agent'));
      throw new AuthenticationError(
        'Empresa inativa. Entre em contato com o suporte.'
      );
    }

    // Enhanced validation for admin users
    if (['admin', 'super_admin', 'empresa_admin'].includes(user.user_type)) {
      try {
        const adminValidation = await verifyAdminCredentials(email, password);
        if (!adminValidation.isValid) {
          console.log('Admin login failed - validation failed', { 
            email, 
            reason: adminValidation.reason,
            ip: req.ip 
          });
          await logAdminAccess(email, user.id, 'admin_login_failed', adminValidation.reason, req.ip, req.get('User-Agent'));
          throw new AuthenticationError('Credenciais administrativas inválidas');
        }
        
        // Log successful admin access
        await logAdminAccess(email, user.id, 'admin_login_success', 'valid_credentials', req.ip, req.get('User-Agent'));
      } catch (error) {
        console.error('Admin validation error', { email, error: error.message, ip: req.ip });
        await logAdminAccess(email, user.id, 'admin_login_error', error.message, req.ip, req.get('User-Agent'));
        throw new AuthenticationError('Erro na validação administrativa');
      }
    } else {
      // Standard password verification for non-admin users
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        console.log('Login failed - invalid password', { email, ip: req.ip });
        await logAdminAccess(email, user.id, 'login_failed', 'invalid_password', req.ip, req.get('User-Agent'));
        throw new AuthenticationError('Credenciais inválidas');
      }
    }

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      userType: user.user_type,
      companyId: user.company_id
    };

    const expiresIn = remember ? '30d' : '24h';
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn });

    // Update last login using secure function
    try {
      await updateLastLogin(user.id);
    } catch (error) {
      console.log('Failed to update last login', { userId: user.id, error: error.message });
    }

    // Remove sensitive data
    delete user.password_hash;

    // User authentication successful

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        token,
        user,
        expiresIn
      }
    });
  })
);

/**
 * @swagger
 * /api/auth/admin-login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login administrativo
 *     description: |
 *       Endpoint específico para login de usuários administrativos com validações rigorosas.
 *       Inclui logs de auditoria e verificações de segurança adicionais.
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
 *                 example: "admin@exemplo.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "senha123"
 *               remember:
 *                 type: boolean
 *                 description: Se true, token expira em 30 dias
 *                 example: false
 *               adminCode:
 *                 type: string
 *                 description: Código adicional de segurança (opcional)
 *                 example: "ADM2024"
 *     responses:
 *       200:
 *         description: Login administrativo realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login administrativo realizado com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     expiresIn:
 *                       type: string
 *                       example: "24h"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Credenciais administrativas inválidas
 *       403:
 *         description: Usuário não possui privilégios administrativos
 */
router.post(
  '/admin-login',
  validateRequest(authSchemas.adminLogin),
  asyncHandler(async (req, res) => {
    const { email, password, remember = false, adminCode } = req.body;

    // Enhanced logging for admin login attempts
    console.log('Admin login attempt', { 
      email, 
      ip: req.ip, 
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    try {
      // Use dedicated admin verification function
      const adminValidation = await verifyAdminCredentials(email, password);
      
      if (!adminValidation.isValid) {
        console.error('Admin login failed - validation failed', { 
          email, 
          reason: adminValidation.reason,
          ip: req.ip 
        });
        await logAdminAccess(email, adminValidation.user?.id, 'admin_login_failed', adminValidation.reason, req.ip, req.get('User-Agent'));
        throw new AuthenticationError('Credenciais administrativas inválidas');
      }

      const user = adminValidation.user;

      // Additional security check with admin code if provided
      if (adminCode && process.env.ADMIN_SECURITY_CODE && adminCode !== process.env.ADMIN_SECURITY_CODE) {
        console.error('Admin login failed - invalid admin code', { email, ip: req.ip });
        await logAdminAccess(email, user.id, 'admin_login_failed', 'invalid_admin_code', req.ip, req.get('User-Agent'));
        throw new AuthenticationError('Código de segurança administrativo inválido');
      }

      // Generate JWT token with admin privileges
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
        userType: user.user_type,
        companyId: user.company_id,
        isAdmin: true
      };

      const expiresIn = remember ? '30d' : '12h'; // Shorter expiration for admin tokens
      const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn });

      // Update last login
      try {
        await updateLastLogin(user.id);
      } catch (error) {
        console.log('Failed to update admin last login', { userId: user.id, error: error.message });
      }

      // Log successful admin access
      await logAdminAccess(email, user.id, 'admin_login_success', 'valid_credentials', req.ip, req.get('User-Agent'));
      
      console.log('Admin login successful', { 
        userId: user.id, 
        email: user.email, 
        userType: user.user_type,
        ip: req.ip 
      });

      // Remove sensitive data
      delete user.password_hash;

      res.json({
        success: true,
        message: 'Login administrativo realizado com sucesso',
        data: {
          token,
          user,
          expiresIn,
          adminAccess: true
        }
      });

    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      console.error('Admin login error', { 
        email, 
        error: error.message, 
        stack: error.stack,
        ip: req.ip 
      });
      await logAdminAccess(email, null, 'admin_login_error', error.message, req.ip, req.get('User-Agent'));
      throw new AuthenticationError('Erro na autenticação administrativa');
    }
  })
);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Registro de usuário
 *     description: |
 *       Registra um novo usuário no sistema.
 *       Apenas administradores podem criar novos usuários.
 *     security:
 *       - bearerAuth: []
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
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@exemplo.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "senha123"
 *               role:
 *                 type: string
 *                 enum: [admin, manager, inspector, viewer]
 *                 example: "inspector"
 *               phone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Usuário criado com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Email já existe
 */
router.post(
  '/register',
  authMiddleware,
  validateRequest(authSchemas.register),
  asyncHandler(async (req, res) => {
    const { name, email, password, role, phone } = req.body;
    const { user: currentUser } = req;

    // Only admins and managers can create users
    if (!['admin', 'manager'].includes(currentUser.role)) {
      throw new AuthenticationError('Sem permissão para criar usuários');
    }

    console.log('User registration attempt', {
      email,
      role,
      createdBy: currentUser.id,
      ip: req.ip
    });

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      throw new ValidationError('Email já está em uso');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        name,
        email: email.toLowerCase(),
        password_hash: passwordHash,
        role,
        phone,
        company_id: currentUser.company_id,
        status: 'active',
        created_by: currentUser.id
      })
      .select(
        `
        id,
        name,
        email,
        role,
        phone,
        status,
        company_id,
        created_at
      `
      )
      .single();

    if (createError) {
      // Login error handled silently for production
      throw new AppError('Erro ao criar usuário');
    }

    console.log('User created successfully', {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      createdBy: currentUser.id
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: newUser
      }
    });
  })
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Dados do usuário atual
 *     description: Retorna os dados do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { user } = req;

    // Get fresh user data with company info
    const { data: userData, error } = await supabase
      .from('users')
      .select(
        `
        id,
        name,
        email,
        role,
        phone,
        status,
        company_id,
        last_login,
        created_at,
        companies!inner(
          id,
          name,
          status,
          plan
        )
      `
      )
      .eq('id', user.id)
      .single();

    if (error || !userData) {
      throw new AuthenticationError('Usuário não encontrado');
    }

    res.json({
      success: true,
      data: {
        user: userData
      }
    });
  })
);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Renovar token
 *     description: |
 *       Renova o token JWT do usuário.
 *       O token atual deve ser válido.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Token renovado com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *                       example: "24h"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post(
  '/refresh',
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { user } = req;

    // Generate new token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.company_id
    };

    const expiresIn = '24h';
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn });

    console.log('Token refreshed', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        token,
        expiresIn
      }
    });
  })
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Alterar senha
 *     description: Permite ao usuário alterar sua própria senha
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "senhaAtual123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "novaSenha456"
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Senha atual incorreta
 */
router.post(
  '/change-password',
  authMiddleware,
  validateRequest(authSchemas.changePassword),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const { user } = req;

    console.log('Password change attempt', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    // Get current password hash
    const { data: userData, error } = await supabase
      .from('users')
      .select('password_hash')
      .eq('id', user.id)
      .single();

    if (error || !userData) {
      throw new AuthenticationError('Usuário não encontrado');
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      userData.password_hash
    );
    if (!isValidPassword) {
      console.log('Password change failed - invalid current password', {
        userId: user.id,
        ip: req.ip
      });
      throw new AuthenticationError('Senha atual incorreta');
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Password update failed:', updateError);
      throw new AppError('Erro ao alterar senha');
    }

    console.log('Password changed successfully', {
      userId: user.id,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  })
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout
 *     description: |
 *       Realiza logout do usuário.
 *       Note: Como usamos JWT stateless, o logout é apenas informativo.
 *       O cliente deve descartar o token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logout realizado com sucesso"
 */
router.post(
  '/logout',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { user } = req;

    if (user) {
      console.log('User logged out', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
    }

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  })
);

module.exports = router;
