const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase.js');
// const { logger, authLogger } = require('../../config/logger.js'); // Temporarily disabled to avoid circular dependency
const {
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  NotFoundError
} = require('../../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../../middleware/validation.js');
const { authSupabase } = require('../../middleware/auth.js');

const router = express.Router();

// Debug endpoint for portal login
router.post(
  '/portal/login/debug',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const startTime = Date.now();

    console.log('DEBUG: Portal login attempt started', { email, startTime });

    try {
      // Step 1: Test Supabase Auth
      console.log('DEBUG: Step 1 - Testing Supabase Auth');
      const authStart = Date.now();
      
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password
        });

      const authEnd = Date.now();
      console.log('DEBUG: Supabase Auth completed', { 
        duration: authEnd - authStart,
        success: !authError,
        userId: authData?.user?.id
      });

      if (authError || !authData.user) {
        console.log('DEBUG: Auth failed', { authError });
        throw new AuthenticationError('Credenciais inválidas');
      }

      // Step 2: Test simple portal_users query (without JOIN)
      console.log('DEBUG: Step 2 - Testing simple portal_users query');
      const queryStart = Date.now();
      
      const { data: portalUser, error: userError } = await supabase
        .from('portal_users')
        .select('id, nome, email, role, permissions, ativo, empresa_id, first_login_completed, auth_user_id')
        .eq('auth_user_id', authData.user.id)
        .eq('ativo', true)
        .single();

      const queryEnd = Date.now();
      console.log('DEBUG: Simple query completed', { 
        duration: queryEnd - queryStart,
        success: !userError,
        userFound: !!portalUser
      });

      if (userError || !portalUser) {
        console.log('DEBUG: User query failed', { 
          userError,
          authUserId: authData.user.id
        });
        throw new AuthenticationError('Usuário não encontrado ou inativo');
      }

      // Step 3: Test separate empresas query
      console.log('DEBUG: Step 3 - Testing separate empresas query');
      const empresaStart = Date.now();
      
      let empresaData = null;
      if (portalUser.empresa_id) {
        const { data: empresa, error: empresaError } = await supabase
          .from('empresas')
          .select('id, nome')
          .eq('id', portalUser.empresa_id)
          .single();
        
        const empresaEnd = Date.now();
        console.log('DEBUG: Empresas query completed', { 
          duration: empresaEnd - empresaStart,
          success: !empresaError,
          empresaFound: !!empresa
        });
        
        empresaData = empresa;
      }

      const totalEnd = Date.now();
      console.log('DEBUG: Total login process completed', { 
        totalDuration: totalEnd - startTime
      });

      res.json({
        success: true,
        message: 'Debug login realizado com sucesso',
        debug: {
          totalDuration: totalEnd - startTime,
          steps: {
            auth: authEnd - authStart,
            userQuery: queryEnd - queryStart,
            empresaQuery: empresaData ? (empresaEnd - empresaStart) : 0
          }
        },
        data: {
          access_token: authData.session.access_token,
          user: {
            id: portalUser.id,
            name: portalUser.nome,
            email: portalUser.email,
            role: portalUser.role,
            user_type: 'portal_user',
            company: empresaData ? {
              id: empresaData.id,
              name: empresaData.nome
            } : null
          }
        }
      });

    } catch (error) {
      const errorEnd = Date.now();
      console.log('DEBUG: Login failed', { 
        error: error.message,
        duration: errorEnd - startTime
      });
      throw error;
    }
  })
);

// DEBUG: Endpoint temporário para verificar configurações
router.get('/debug/config', (req, res) => {
  res.json({
    supabase_url: process.env.SUPABASE_URL || 'NOT_SET',
    supabase_anon_key_length: process.env.SUPABASE_ANON_KEY
      ? process.env.SUPABASE_ANON_KEY.length
      : 0,
    supabase_service_key_length: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? process.env.SUPABASE_SERVICE_ROLE_KEY.length
      : 0,
    jwt_secret_length: process.env.JWT_SECRET
      ? process.env.JWT_SECRET.length
      : 0,
    node_env: process.env.NODE_ENV || 'NOT_SET',
    port: process.env.PORT || 'NOT_SET'
  });
});

// Validation schemas
const authSchemas = {
  login: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
    })
  },
  appLogin: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres')
    })
  },
  portalLogin: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
      remember: z.boolean().optional().default(false)
    })
  },
  register: {
    body: z.object({
      name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
      email: commonSchemas.email,
      password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
      phone: z.string().optional(),
      user_type: z.enum(['app_user', 'portal_user'])
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
  },
  setFirstPassword: {
    body: z
      .object({
        email: commonSchemas.email,
        temporary_password: z.string().min(1, 'Senha temporária é obrigatória'),
        new_password: z.string().min(6, 'Nova senha deve ter pelo menos 6 caracteres'),
        confirm_password: z
          .string()
          .min(1, 'Confirmação de senha é obrigatória')
      })
      .refine(data => data.new_password === data.confirm_password, {
        message: 'Senhas não coincidem',
        path: ['confirm_password']
      })
  }
};

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login simples para usuários (MVP)
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
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais inválidas
 */
router.post(
  '/login',
  validateRequest(authSchemas.login),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    console.log('Simple login attempt', { email, ip: req.ip });

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

    if (authError || !authData.user) {
      console.log('Simple login failed - invalid credentials', {
        email,
        ip: req.ip
      });
      throw new AuthenticationError('Credenciais inválidas');
    }

    // Try to get user from app_users first, then from clients
    let userData = null;
    let userType = null;

    // Check app_users table (using email for now)
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, nome, email, empresa_id, role, ativo, first_login_completed')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .single();

    if (appUser) {
      userData = appUser;
      userType = 'admin';
    } else {
      // Check clients table (using email for now)
      const { data: client } = await supabase
        .from('clients')
        .select('id, name, email, tenant, is_active')
        .eq('email', email.toLowerCase())
        .eq('is_active', true)
        .single();

      if (client) {
        userData = {
          id: client.id,
          nome: client.name,
          email: client.email,
          tenant_id: client.tenant,
          ativo: client.is_active
        };
        userType = 'client';
      }
    }

    if (!userData) {
      console.log('Simple login failed - user not found', {
        email,
        supabaseUid: authData.user.id,
        ip: req.ip
      });
      throw new AuthenticationError('Usuário não encontrado ou inativo');
    }

    // Check if user needs to set first password
    if (userType === 'admin' && userData.first_login_completed === false) {
      console.log('User needs to set first password', {
        userId: userData.id,
        email,
        ip: req.ip
      });
      
      // Sign out the temporary session
      await supabase.auth.signOut();
      
      return res.status(202).json({
        success: false,
        message: 'Primeiro login detectado. Defina sua senha.',
        requires_first_password: true,
        data: {
          email: userData.email,
          nome: userData.nome
        }
      });
    }

    console.log('Simple login successful', {
      userId: userData.id,
      email,
      userType,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        user: {
          id: userData.id,
          nome: userData.nome,
          email: userData.email,
          user_type: userType,
          tenant_id: userData.tenant_id || null
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/app/login:
 *   post:
 *     tags: [Authentication - App]
 *     summary: Login para usuários do aplicativo móvel
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
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais inválidas
 */
router.post(
  '/app/login',
  validateRequest(authSchemas.appLogin),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    console.log('App login attempt', { email, ip: req.ip });

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

    if (authError || !authData.user) {
      console.log('App login failed - invalid credentials', {
        email,
        ip: req.ip
      });
      throw new AuthenticationError('Credenciais inválidas');
    }

    // DEBUG: Log the auth user ID for debugging
    console.log('DEBUG: Supabase Auth successful', {
      email,
      supabaseUid: authData.user.id,
      ip: req.ip
    });

    // Get user data from app_users table (without forcing INNER JOIN)
    const { data: appUser, error: userError } = await supabase
      .from('app_users')
      .select(
        `
        id,
        nome,
        email,
        empresa_id,
        role,
        ativo,
        auth_user_id,
        first_login_completed
      `
      )
      .eq('auth_user_id', authData.user.id)
      .eq('ativo', true)
      .single();

    // DEBUG: Log detailed query results
    console.log('DEBUG: app_users query result', {
      email,
      supabaseUid: authData.user.id,
      userError: userError ? userError.message : null,
      userErrorCode: userError ? userError.code : null,
      userErrorDetails: userError ? userError.details : null,
      appUserFound: !!appUser,
      appUserData: appUser
        ? {
            id: appUser.id,
            nome: appUser.nome,
            email: appUser.email,
            empresa_id: appUser.empresa_id,
            ativo: appUser.ativo,
            auth_user_id: appUser.auth_user_id
          }
        : null,
      ip: req.ip
    });

    if (userError || !appUser) {
      console.log('App login failed - user not found in app_users', {
        email,
        supabaseUid: authData.user.id,
        userError: userError ? userError.message : 'No error message',
        userErrorCode: userError ? userError.code : 'No error code',
        userErrorDetails: userError ? userError.details : 'No error details',
        ip: req.ip
      });
      throw new AuthenticationError('Usuário não encontrado ou inativo');
    }

    // Check if user needs to set first password
    if (appUser.first_login_completed === false) {
      console.log('App user needs to set first password', {
        userId: appUser.id,
        email,
        ip: req.ip
      });
      
      // Sign out the temporary session
      await supabase.auth.signOut();
      
      return res.status(202).json({
        success: false,
        message: 'Primeiro login detectado. Defina sua senha.',
        requires_first_password: true,
        data: {
          email: appUser.email,
          nome: appUser.nome
        }
      });
    }

    // Check if company is active
    // if (appUser.empresas.status !== 'active') {
    //   authLogger.warn('App login failed - company inactive', {
    //     email,
    //     companyId: appUser.empresa_id,
    //     ip: req.ip
    //   });
    //   throw new AuthenticationError(
    //     'Empresa inativa. Entre em contato com o suporte.'
    //   );
    // }

    // Update last login
    await supabase
      .from('app_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', appUser.id);

    console.log('App login successful', {
      userId: appUser.id,
      email,
      companyId: appUser.empresa_id
    });

    // Get company data separately if needed
    let companyData = null;
    if (appUser.empresa_id) {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('id', appUser.empresa_id)
        .single();
      companyData = empresa;
    }

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        user: {
          id: appUser.id,
          nome: appUser.nome,
          email: appUser.email,
          user_type: 'app_user',
          company: companyData
            ? {
                id: companyData.id,
                nome: companyData.nome
              }
            : null
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/portal/login:
 *   post:
 *     tags: [Authentication - Portal]
 *     summary: Login para usuários do portal web
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
 *                 minLength: 6
 *               remember:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 */
router.post(
  '/portal/login',
  validateRequest(authSchemas.portalLogin),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    console.log('Portal login attempt', { email, ip: req.ip });

    // Authenticate with Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

    if (authError || !authData.user) {
      console.log('Portal login failed - invalid credentials', {
        email,
        ip: req.ip
      });
      throw new AuthenticationError('Credenciais inválidas');
    }

    // Get user data from portal_users table (without JOIN to avoid coercion error)
    const { data: portalUser, error: userError } = await supabase
      .from('portal_users')
      .select(
        `
        id,
        nome,
        email,
        role,
        permissions,
        ativo,
        empresa_id,
        first_login_completed
      `
      )
      .eq('auth_user_id', authData.user.id)
      .eq('ativo', true)
      .single();

    console.log('DEBUG: portal_users query result', {
      email,
      supabaseUid: authData.user.id,
      userError: userError ? userError.message : null,
      portalUserFound: !!portalUser,
      portalUserData: portalUser ? {
        id: portalUser.id,
        nome: portalUser.nome,
        email: portalUser.email,
        empresa_id: portalUser.empresa_id,
        ativo: portalUser.ativo
      } : null
    });

    if (userError || !portalUser) {
      console.log('Portal login failed - user not found in portal_users', {
        email,
        supabaseUid: authData.user.id,
        ip: req.ip
      });
      throw new AuthenticationError('Usuário não encontrado ou inativo');
    }

    // Check if user needs to set first password
    if (portalUser.first_login_completed === false) {
      console.log('Portal user needs to set first password', {
        userId: portalUser.id,
        email,
        ip: req.ip
      });
      
      // Sign out the temporary session
      await supabase.auth.signOut();
      
      return res.status(202).json({
        success: false,
        message: 'Primeiro login detectado. Defina sua senha.',
        requires_first_password: true,
        data: {
          email: portalUser.email,
          nome: portalUser.nome
        }
      });
    }

    // Check if company is active (assuming empresas table has ativo column)
    // if (portalUser.empresas.ativo !== true) {
    //   authLogger.warn('Portal login failed - company inactive', {
    //     email,
    //     companyId: portalUser.empresa_id,
    //     ip: req.ip
    //   });
    //   throw new AuthenticationError(
    //     'Empresa inativa. Entre em contato com o suporte.'
    //   );
    // }

    // Update user app_metadata with company info (temporarily disabled for debugging)
    // const { error: updateError } = await supabase.auth.admin.updateUserById(
    //   authData.user.id,
    //   {
    //     app_metadata: {
    //       ...authData.user.app_metadata,
    //       user_type: 'portal_user',
    //       user_id: portalUser.id,
    //       empresa_id: portalUser.empresa_id,
    //       empresa_slug: 'default',
    //       role: portalUser.role,
    //       nome: portalUser.nome,
    //       permissions: portalUser.permissions || []
    //     }
    //   }
    // );

    // if (updateError) {
    //   console.log('Failed to update user metadata', {
    //     userId: portalUser.id,
    //     error: updateError.message
    //   });
    // }
    
    console.log('Skipping metadata update for debugging');

    // Update last login
    await supabase
      .from('portal_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', portalUser.id);

    console.log('Portal login successful', {
      userId: portalUser.id,
      email,
      companyId: portalUser.empresa_id
    });

    // Get company data separately to avoid JOIN issues
    let companyData = null;
    if (portalUser.empresa_id) {
      const { data: empresa } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('id', portalUser.empresa_id)
        .single();
      companyData = empresa;
    }

    res.json({
      success: true,
      message: 'Login realizado com sucesso',
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        user: {
          id: portalUser.id,
          name: portalUser.nome,
          email: portalUser.email,
          role: portalUser.role,
          permissions: portalUser.permissions,
          user_type: 'portal_user',
          company: companyData ? {
            id: companyData.id,
            name: companyData.nome
          } : null
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout do usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 */
router.post(
  '/logout',
  authSupabase,
  asyncHandler(async (req, res) => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('Logout error:', error);
      throw new AppError('Erro ao fazer logout', 500);
    }

    console.log('User logged out', { userId: req.user?.id });

    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Obter dados do usuário atual
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 */
router.get(
  '/me',
  authSupabase,
  asyncHandler(async (req, res) => {
    const user = req.user;
    const userType = req.userType;

    let userData;

    if (userType === 'app_user') {
      const { data: appUser, error } = await supabase
        .from('app_users')
        .select(
          `
          id,
          name,
          email,
          phone,
          status,
          empresa_id,
          empresas!inner(
            id,
            name
          )
        `
        )
        .eq('auth_user_id', user.id)
        .single();

      if (error || !appUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      userData = {
        ...appUser,
        user_type: 'app_user',
        company: appUser.empresas
      };
      delete userData.empresas;
    } else {
      const { data: portalUser, error } = await supabase
        .from('portal_users')
        .select(
          `
          id,
          nome,
          email,
          role,
          empresa_id,
          empresas!inner(
            id,
            nome
          )
        `
        )
        .eq('auth_user_id', user.id)
        .single();

      if (error || !portalUser) {
        throw new NotFoundError('Usuário não encontrado');
      }

      userData = {
        ...portalUser,
        user_type: 'portal_user',
        company: portalUser.empresas
      };
      delete userData.empresas;
    }

    res.json({
      success: true,
      data: userData
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Authentication]
 *     summary: Renovar token de acesso
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refresh_token: refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token é obrigatório');
    }

    const { data: authData, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !authData.session) {
      throw new AuthenticationError('Token inválido ou expirado');
    }

    res.json({
      success: true,
      message: 'Token renovado com sucesso',
      data: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/set-first-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Definir senha no primeiro login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - temporary_password
 *               - new_password
 *               - confirm_password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               temporary_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 minLength: 6
 *               confirm_password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha definida com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Senha temporária inválida
 */
router.post(
  '/set-first-password',
  validateRequest(authSchemas.setFirstPassword),
  asyncHandler(async (req, res) => {
    const { email, temporary_password, new_password } = req.body;

    console.log('First password setup attempt', { email, ip: req.ip });

    // Authenticate with temporary password
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: temporary_password
      });

    if (authError || !authData.user) {
      console.log('First password setup failed - invalid temporary password', {
        email,
        ip: req.ip
      });
      throw new AuthenticationError('Senha temporária inválida');
    }

    // Check if user exists and hasn't completed first login
    let userData = null;
    let userTable = null;

    // Check app_users table
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, nome, email, first_login_completed, auth_user_id')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .single();

    if (appUser) {
      userData = appUser;
      userTable = 'app_users';
    } else {
      // Check portal_users table
      const { data: portalUser } = await supabase
        .from('portal_users')
        .select('id, nome, email, first_login_completed, auth_user_id')
        .eq('email', email.toLowerCase())
        .eq('ativo', true)
        .single();

      if (portalUser) {
        userData = portalUser;
        userTable = 'portal_users';
      }
    }

    if (!userData) {
      console.log('First password setup failed - user not found', {
        email,
        ip: req.ip
      });
      throw new NotFoundError('Usuário não encontrado');
    }

    if (userData.first_login_completed) {
      console.log('First password setup failed - already completed', {
        email,
        userId: userData.id,
        ip: req.ip
      });
      throw new ValidationError('Usuário já completou o primeiro login');
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: new_password
    });

    if (updateError) {
      console.error('First password setup failed - password update error', {
        email,
        userId: userData.id,
        error: updateError.message,
        ip: req.ip
      });
      throw new AppError('Erro ao atualizar senha', 500);
    }

    // Mark first login as completed
    const { error: dbError } = await supabase
      .from(userTable)
      .update({
        first_login_completed: true,
        password_changed_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      })
      .eq('id', userData.id);

    if (dbError) {
      console.error('First password setup failed - database update error', {
        email,
        userId: userData.id,
        error: dbError.message,
        ip: req.ip
      });
      throw new AppError('Erro ao atualizar dados do usuário', 500);
    }

    // Sign out the temporary session
    await supabase.auth.signOut();

    console.log('First password setup successful', {
      userId: userData.id,
      email,
      userTable,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Senha definida com sucesso. Faça login com sua nova senha.',
      data: {
        user: {
          id: userData.id,
          nome: userData.nome,
          email: userData.email
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Obter dados do usuário autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *       401:
 *         description: Token inválido ou usuário não encontrado
 */
router.get(
  '/me',
  authSupabase,
  asyncHandler(async (req, res) => {
    const user = req.user;
    
    if (!user) {
      throw new AuthenticationError('Usuário não autenticado');
    }

    // Return user data from the auth middleware
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name || user.nome,
          role: user.role,
          user_type: user.user_type,
          tenant_slug: user.tenant_slug,
          auth_user_id: user.auth_user_id
        }
      }
    });
  })
);

module.exports = router;
