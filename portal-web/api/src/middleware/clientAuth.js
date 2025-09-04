// Middleware de autenticação para clientes
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

// Middleware para autenticar clientes
const clientAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    const token = authHeader.substring(7);
    
    // Verificar token JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'grifo-secret-key');
    
    // Verificar se o usuário existe e é um cliente
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .eq('user_type', 'client')
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido ou usuário não encontrado' });
    }

    // Adicionar informações do usuário à requisição
    req.user = user;
    req.userId = user.id;
    req.userType = user.user_type;
    req.tenant = user.tenant;
    
    next();
  } catch (error) {
    console.error('Erro na autenticação do cliente:', error);
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// Middleware para verificar se o usuário é cliente
const requireClient = (req, res, next) => {
  if (req.userType !== 'client') {
    return res.status(403).json({ error: 'Acesso negado. Apenas clientes podem acessar este recurso.' });
  }
  next();
};

// Função para autenticar cliente (alias)
const authenticateClient = clientAuth;

module.exports = {
  clientAuth,
  requireClient,
  authenticateClient
};
