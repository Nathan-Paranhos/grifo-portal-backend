const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

/**
 * Middleware para validar usuários administradores
 * Verifica se o usuário existe, tem permissões corretas e está ativo
 */
const validateAdmin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // Buscar usuário no banco de dados
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !user) {
      // Log da tentativa de acesso inválida
      console.log(`[SECURITY] Tentativa de login com email inexistente: ${email} - IP: ${req.ip} - ${new Date().toISOString()}`);
      
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verificar se o usuário é administrador
    const adminTypes = ['admin', 'super_admin', 'empresa_admin'];
    if (!adminTypes.includes(user.user_type)) {
      // Log da tentativa de acesso não autorizada
      console.log(`[SECURITY] Tentativa de acesso admin por usuário não-admin: ${email} (${user.user_type}) - IP: ${req.ip} - ${new Date().toISOString()}`);
      
      return res.status(403).json({
        error: 'Acesso negado. Usuário não possui permissões administrativas',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Verificar se o usuário está ativo
    if (!user.is_active || user.status !== 'active') {
      // Log da tentativa de acesso com usuário inativo
      console.log(`[SECURITY] Tentativa de login com usuário inativo: ${email} (status: ${user.status}, is_active: ${user.is_active}) - IP: ${req.ip} - ${new Date().toISOString()}`);
      
      return res.status(403).json({
        error: 'Conta desativada. Entre em contato com o administrador',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // Verificar senha
    let passwordValid = false;
    
    if (user.password_hash) {
      // Verificar senha com hash
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Para usuários sem hash (migração), verificar senha simples temporariamente
      passwordValid = (password === 'password' && user.email === 'admin@grifo.com');
    }

    if (!passwordValid) {
      // Log da tentativa de login com senha incorreta
      console.log(`[SECURITY] Tentativa de login com senha incorreta: ${email} - IP: ${req.ip} - ${new Date().toISOString()}`);
      
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Atualizar último login
    await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Log de login bem-sucedido
    console.log(`[AUDIT] Login admin bem-sucedido: ${email} (${user.user_type}) - IP: ${req.ip} - ${new Date().toISOString()}`);

    // Adicionar dados do usuário à requisição
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name || user.nome,
      user_type: user.user_type,
      company_id: user.company_id,
      permissions: {
        can_create_vistorias: user.can_create_vistorias,
        can_edit_vistorias: user.can_edit_vistorias,
        can_view_all_company_data: user.can_view_all_company_data
      }
    };

    next();
  } catch (error) {
    console.error('[ERROR] Erro na validação de admin:', error);
    
    return res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware para verificar se o usuário logado tem permissões específicas
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!req.user.permissions[permission]) {
      console.log(`[SECURITY] Acesso negado por falta de permissão '${permission}': ${req.user.email} - IP: ${req.ip} - ${new Date().toISOString()}`);
      
      return res.status(403).json({
        error: `Permissão '${permission}' necessária`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se o usuário é super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Usuário não autenticado',
      code: 'NOT_AUTHENTICATED'
    });
  }

  if (req.user.user_type !== 'super_admin') {
    console.log(`[SECURITY] Acesso negado - Super Admin necessário: ${req.user.email} (${req.user.user_type}) - IP: ${req.ip} - ${new Date().toISOString()}`);
    
    return res.status(403).json({
      error: 'Acesso restrito a Super Administradores',
      code: 'SUPER_ADMIN_REQUIRED'
    });
  }

  next();
};

module.exports = {
  validateAdmin,
  requirePermission,
  requireSuperAdmin
};
