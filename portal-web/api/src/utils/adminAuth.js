const { supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

/**
 * Função segura para verificar credenciais de administrador
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @param {string} requiredUserType - Tipo de usuário necessário (opcional)
 * @returns {Object} Resultado da verificação
 */
const verifyAdminCredentials = async (email, password, requiredUserType = null) => {
  try {
    // Validar parâmetros de entrada
    if (!email || !password) {
      return {
        success: false,
        error: 'Email e senha são obrigatórios',
        code: 'MISSING_CREDENTIALS'
      };
    }

    // Normalizar email
    const normalizedEmail = email.toLowerCase().trim();

    // Buscar usuário no banco de dados
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        nome,
        user_type,
        is_active,
        status,
        password_hash,
        company_id,
        tenant_id,
        can_create_vistorias,
        can_edit_vistorias,
        can_view_all_company_data,
        first_login_completed,
        last_login,
        created_at
      `)
      .eq('email', normalizedEmail)
      .single();

    if (userError || !user) {
      return {
        success: false,
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS',
        audit: {
          action: 'LOGIN_FAILED',
          reason: 'USER_NOT_FOUND',
          email: normalizedEmail
        }
      };
    }

    // Verificar se o usuário é administrador
    const adminTypes = ['admin', 'super_admin', 'empresa_admin'];
    if (!adminTypes.includes(user.user_type)) {
      return {
        success: false,
        error: 'Acesso negado. Usuário não possui permissões administrativas',
        code: 'INSUFFICIENT_PERMISSIONS',
        audit: {
          action: 'LOGIN_FAILED',
          reason: 'NOT_ADMIN',
          email: normalizedEmail,
          user_type: user.user_type
        }
      };
    }

    // Verificar tipo específico se necessário
    if (requiredUserType && user.user_type !== requiredUserType) {
      return {
        success: false,
        error: `Acesso restrito a usuários do tipo '${requiredUserType}'`,
        code: 'INSUFFICIENT_USER_TYPE',
        audit: {
          action: 'LOGIN_FAILED',
          reason: 'WRONG_USER_TYPE',
          email: normalizedEmail,
          user_type: user.user_type,
          required_type: requiredUserType
        }
      };
    }

    // Verificar se o usuário está ativo
    if (!user.is_active || user.status !== 'active') {
      return {
        success: false,
        error: 'Conta desativada. Entre em contato com o administrador',
        code: 'ACCOUNT_DISABLED',
        audit: {
          action: 'LOGIN_FAILED',
          reason: 'ACCOUNT_DISABLED',
          email: normalizedEmail,
          status: user.status,
          is_active: user.is_active
        }
      };
    }

    // Verificar senha
    let passwordValid = false;
    
    if (user.password_hash) {
      // Verificar senha com hash bcrypt
      passwordValid = await bcrypt.compare(password, user.password_hash);
    } else {
      // Para usuários sem hash (migração), verificar senha padrão temporariamente
      // ATENÇÃO: Isso deve ser removido em produção após migração completa
      passwordValid = (password === 'password' && user.email === 'admin@grifo.com');
    }

    if (!passwordValid) {
      return {
        success: false,
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS',
        audit: {
          action: 'LOGIN_FAILED',
          reason: 'WRONG_PASSWORD',
          email: normalizedEmail
        }
      };
    }

    // Login bem-sucedido - preparar dados do usuário
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name || user.nome,
      user_type: user.user_type,
      company_id: user.company_id,
      tenant_id: user.tenant_id,
      is_active: user.is_active,
      status: user.status,
      first_login_completed: user.first_login_completed,
      last_login: user.last_login,
      permissions: {
        can_create_vistorias: user.can_create_vistorias,
        can_edit_vistorias: user.can_edit_vistorias,
        can_view_all_company_data: user.can_view_all_company_data
      },
      created_at: user.created_at
    };

    return {
      success: true,
      user: userData,
      audit: {
        action: 'LOGIN_SUCCESS',
        email: normalizedEmail,
        user_type: user.user_type
      }
    };

  } catch (error) {
    console.error('[ERROR] Erro na verificação de credenciais admin:', error);
    
    return {
      success: false,
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR',
      audit: {
        action: 'LOGIN_ERROR',
        error: error.message
      }
    };
  }
};

/**
 * Função para verificar se um usuário existe e é administrador
 * @param {string} userId - ID do usuário
 * @returns {Object} Resultado da verificação
 */
const verifyAdminById = async (userId) => {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'ID do usuário é obrigatório',
        code: 'MISSING_USER_ID'
      };
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        nome,
        user_type,
        is_active,
        status,
        company_id,
        tenant_id,
        can_create_vistorias,
        can_edit_vistorias,
        can_view_all_company_data
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return {
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      };
    }

    const adminTypes = ['admin', 'super_admin', 'empresa_admin'];
    if (!adminTypes.includes(user.user_type)) {
      return {
        success: false,
        error: 'Usuário não é administrador',
        code: 'NOT_ADMIN'
      };
    }

    if (!user.is_active || user.status !== 'active') {
      return {
        success: false,
        error: 'Usuário não está ativo',
        code: 'USER_INACTIVE'
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || user.nome,
        user_type: user.user_type,
        company_id: user.company_id,
        tenant_id: user.tenant_id,
        permissions: {
          can_create_vistorias: user.can_create_vistorias,
          can_edit_vistorias: user.can_edit_vistorias,
          can_view_all_company_data: user.can_view_all_company_data
        }
      }
    };

  } catch (error) {
    console.error('[ERROR] Erro na verificação de admin por ID:', error);
    
    return {
      success: false,
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    };
  }
};

/**
 * Função para atualizar o último login do usuário
 * @param {string} userId - ID do usuário
 * @returns {boolean} Sucesso da operação
 */
const updateLastLogin = async (userId) => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userId);

    return !error;
  } catch (error) {
    console.error('[ERROR] Erro ao atualizar último login:', error);
    return false;
  }
};

module.exports = {
  verifyAdminCredentials,
  verifyAdminById,
  updateLastLogin
};
