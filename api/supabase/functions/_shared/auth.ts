import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type UserRole = 'superadmin' | 'admin' | 'corretor' | 'leitura';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  empresa_id: string;
}

/**
 * Cria cliente Supabase com token de autorização
 */
export function createSupabaseClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    }
  );
}

/**
 * Extrai e valida o token de autorização do header
 */
export function extractAuthToken(req: Request): string {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    throw new Error('Token de autorização necessário');
  }

  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Formato de token inválido. Use: Bearer <token>');
  }

  return authHeader;
}

/**
 * Obtém informações do usuário autenticado
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<AuthUser> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Usuário não autenticado');
  }

  // Buscar informações completas do usuário na tabela usuarios
  const { data: userData, error: userError } = await supabase
    .from('usuarios')
    .select('id, email, nome, role, empresa_id')
    .eq('id', user.id)
    .single();

  if (userError || !userData) {
    throw new Error('Dados do usuário não encontrados');
  }

  return {
    id: userData.id,
    email: userData.email,
    role: userData.role as UserRole,
    empresa_id: userData.empresa_id,
  };
}

/**
 * Verifica se o usuário tem o papel necessário
 */
export function requireRole(
  user: AuthUser, 
  requiredRoles: UserRole | UserRole[]
): void {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  if (!roles.includes(user.role)) {
    throw new Error(
      `Acesso negado. Papel necessário: ${roles.join(' ou ')}. Seu papel: ${user.role}`
    );
  }
}

/**
 * Verifica se o usuário é superadmin
 */
export function isSuperAdmin(user: AuthUser): boolean {
  return user.role === 'superadmin';
}

/**
 * Verifica se o usuário é admin ou superadmin
 */
export function isAdminOrAbove(user: AuthUser): boolean {
  return ['admin', 'superadmin'].includes(user.role);
}

/**
 * Verifica se o usuário pode acessar dados de uma empresa específica
 */
export function canAccessEmpresa(user: AuthUser, empresaId: string): boolean {
  // Superadmin pode acessar qualquer empresa
  if (user.role === 'superadmin') {
    return true;
  }
  
  // Outros usuários só podem acessar sua própria empresa
  return user.empresa_id === empresaId;
}

/**
 * Middleware de autenticação para Edge Functions
 */
export async function withAuth<T>(
  req: Request,
  handler: (req: Request, supabase: SupabaseClient, user: AuthUser) => Promise<T>,
  requiredRoles?: UserRole | UserRole[]
): Promise<T> {
  // Extrair token
  const authHeader = extractAuthToken(req);
  
  // Criar cliente Supabase
  const supabase = createSupabaseClient(authHeader);
  
  // Obter usuário autenticado
  const user = await getAuthenticatedUser(supabase);
  
  // Verificar papel se especificado
  if (requiredRoles) {
    requireRole(user, requiredRoles);
  }
  
  // Executar handler
  return await handler(req, supabase, user);
}

/**
 * Decodifica JWT token (sem verificação de assinatura)
 * Usado apenas para extrair claims básicos
 */
export function decodeJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) {
      throw new Error('Invalid JWT token format');
    }
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error('Token JWT inválido');
  }
}

/**
 * Valida se o token JWT não expirou
 */
export function validateTokenExpiry(token: string): void {
  const decoded = decodeJWT(token.replace('Bearer ', ''));
  const now = Math.floor(Date.now() / 1000);
  
  if (decoded.exp && decoded.exp < now) {
    throw new Error('Token expirado');
  }
}

/**
 * Log de auditoria para ações sensíveis
 */
export async function auditLog(
  supabase: SupabaseClient,
  user: AuthUser,
  action: string,
  details: Record<string, any> = {}
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      user_role: user.role,
      empresa_id: user.empresa_id,
      action,
      details,
      timestamp: new Date().toISOString(),
      ip_address: null, // Pode ser extraído do request se necessário
      user_agent: null, // Pode ser extraído do request se necessário
    });
  } catch (error) {
    console.error('Erro ao registrar log de auditoria:', error);
    // Não falhar a operação principal por erro de auditoria
  }
}