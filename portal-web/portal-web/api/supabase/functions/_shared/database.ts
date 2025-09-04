import { SupabaseClient } from '@supabase/supabase-js';
import { AuthUser } from './auth.ts';

/**
 * Utilitários para operações de banco de dados
 */

/**
 * Interface para paginação
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/**
 * Interface para resultado paginado
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Aplica filtros de empresa baseado no papel do usuário
 */
export function applyEmpresaFilter(
  query: any,
  user: AuthUser,
  empresaIdColumn: string = 'empresa_id'
) {
  // Superadmin pode ver tudo
  if (user.role === 'superadmin') {
    return query;
  }
  
  // Outros usuários só veem dados da sua empresa
  return query.eq(empresaIdColumn, user.empresa_id);
}

/**
 * Executa uma consulta paginada
 */
export async function executePaginatedQuery<T>(
  supabase: SupabaseClient,
  tableName: string,
  user: AuthUser,
  options: PaginationOptions,
  filters: Record<string, any> = {},
  select: string = '*',
  empresaIdColumn: string = 'empresa_id'
): Promise<PaginatedResult<T>> {
  const { page, limit, sort, order } = options;
  const offset = (page - 1) * limit;

  // Construir query base
  let query = supabase
    .from(tableName)
    .select(select, { count: 'exact' });

  // Aplicar filtro de empresa
  query = applyEmpresaFilter(query, user, empresaIdColumn);

  // Aplicar filtros adicionais
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else if (typeof value === 'string' && value.includes('%')) {
        query = query.ilike(key, value);
      } else {
        query = query.eq(key, value);
      }
    }
  });

  // Aplicar ordenação
  if (sort) {
    query = query.order(sort, { ascending: order === 'asc' });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Aplicar paginação
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erro na consulta: ${error.message}`);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: data as T[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Verifica se um registro existe e pertence à empresa do usuário
 */
export async function checkRecordAccess(
  supabase: SupabaseClient,
  tableName: string,
  recordId: string,
  user: AuthUser,
  empresaIdColumn: string = 'empresa_id'
): Promise<boolean> {
  const { data, error } = await supabase
    .from(tableName)
    .select(empresaIdColumn)
    .eq('id', recordId)
    .single();

  if (error || !data) {
    return false;
  }

  // Superadmin pode acessar qualquer registro
  if (user.role === 'superadmin') {
    return true;
  }

  // Outros usuários só podem acessar registros da sua empresa
  return data[empresaIdColumn] === user.empresa_id;
}

/**
 * Obtém estatísticas de uma tabela
 */
export async function getTableStats(
  supabase: SupabaseClient,
  tableName: string,
  user: AuthUser,
  groupBy?: string,
  empresaIdColumn: string = 'empresa_id'
): Promise<any> {
  let query = supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  // Aplicar filtro de empresa
  query = applyEmpresaFilter(query, user, empresaIdColumn);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Erro ao obter estatísticas: ${error.message}`);
  }

  if (!groupBy) {
    return { total: count || 0 };
  }

  // Se groupBy foi especificado, fazer consulta agrupada
  let groupQuery = supabase
    .from(tableName)
    .select(`${groupBy}, count(*)`)
    .group(groupBy);

  groupQuery = applyEmpresaFilter(groupQuery, user, empresaIdColumn);

  const { data: groupData, error: groupError } = await groupQuery;

  if (groupError) {
    throw new Error(`Erro ao agrupar dados: ${groupError.message}`);
  }

  return {
    total: count || 0,
    groups: groupData || [],
  };
}

/**
 * Obtém registros criados nos últimos N dias
 */
export async function getRecentRecords<T>(
  supabase: SupabaseClient,
  tableName: string,
  user: AuthUser,
  days: number = 30,
  select: string = '*',
  empresaIdColumn: string = 'empresa_id'
): Promise<T[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from(tableName)
    .select(select)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  // Aplicar filtro de empresa
  query = applyEmpresaFilter(query, user, empresaIdColumn);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar registros recentes: ${error.message}`);
  }

  return data as T[];
}

/**
 * Calcula tendência (crescimento/decrescimento) entre dois períodos
 */
export function calculateTrend(
  currentValue: number,
  previousValue: number
): {
  value: number;
  percentage: number;
  direction: 'up' | 'down' | 'stable';
} {
  const difference = currentValue - previousValue;
  const percentage = previousValue > 0 ? (difference / previousValue) * 100 : 0;
  
  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (difference > 0) direction = 'up';
  else if (difference < 0) direction = 'down';

  return {
    value: difference,
    percentage: Math.round(percentage * 100) / 100,
    direction,
  };
}

/**
 * Obtém tendências de uma métrica nos últimos períodos
 */
export async function getMetricTrend(
  supabase: SupabaseClient,
  tableName: string,
  user: AuthUser,
  days: number = 30,
  empresaIdColumn: string = 'empresa_id'
): Promise<{
  current: number;
  previous: number;
  trend: ReturnType<typeof calculateTrend>;
}> {
  const now = new Date();
  const currentPeriodStart = new Date(now);
  currentPeriodStart.setDate(now.getDate() - days);
  
  const previousPeriodStart = new Date(currentPeriodStart);
  previousPeriodStart.setDate(currentPeriodStart.getDate() - days);

  // Contar registros do período atual
  let currentQuery = supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', currentPeriodStart.toISOString())
    .lte('created_at', now.toISOString());

  currentQuery = applyEmpresaFilter(currentQuery, user, empresaIdColumn);

  // Contar registros do período anterior
  let previousQuery = supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .gte('created_at', previousPeriodStart.toISOString())
    .lt('created_at', currentPeriodStart.toISOString());

  previousQuery = applyEmpresaFilter(previousQuery, user, empresaIdColumn);

  const [currentResult, previousResult] = await Promise.all([
    currentQuery,
    previousQuery,
  ]);

  if (currentResult.error || previousResult.error) {
    throw new Error('Erro ao calcular tendência');
  }

  const current = currentResult.count || 0;
  const previous = previousResult.count || 0;
  const trend = calculateTrend(current, previous);

  return { current, previous, trend };
}

/**
 * Executa uma transação de banco de dados
 */
export async function executeTransaction(
  supabase: SupabaseClient,
  operations: Array<() => Promise<any>>
): Promise<any[]> {
  const results: any[] = [];
  
  try {
    for (const operation of operations) {
      const result = await operation();
      results.push(result);
    }
    return results;
  } catch (error) {
    // Em caso de erro, idealmente faríamos rollback
    // Mas o Supabase não suporta transações explícitas via REST API
    console.error('Erro na transação:', error);
    throw error;
  }
}

/**
 * Valida se um UUID existe em uma tabela
 */
export async function validateUUIDExists(
  supabase: SupabaseClient,
  tableName: string,
  id: string,
  user?: AuthUser,
  empresaIdColumn?: string
): Promise<boolean> {
  let query = supabase
    .from(tableName)
    .select('id')
    .eq('id', id)
    .single();

  // Aplicar filtro de empresa se especificado
  if (user && empresaIdColumn) {
    query = applyEmpresaFilter(query, user, empresaIdColumn);
  }

  const { data, error } = await query;
  return !error && !!data;
}

/**
 * Obtém o próximo valor de uma sequência
 */
export async function getNextSequenceValue(
  supabase: SupabaseClient,
  sequenceName: string
): Promise<number> {
  const { data, error } = await supabase
    .rpc('nextval', { sequence_name: sequenceName });

  if (error) {
    throw new Error(`Erro ao obter próximo valor da sequência: ${error.message}`);
  }

  return data;
}

/**
 * Formata dados para inserção/atualização
 */
export function formatDatabaseRecord(
  data: Record<string, any>,
  user: AuthUser,
  includeEmpresaId: boolean = true
): Record<string, any> {
  const formatted = { ...data };

  // Adicionar empresa_id se necessário e usuário não for superadmin
  if (includeEmpresaId && user.role !== 'superadmin') {
    formatted.empresa_id = user.empresa_id;
  }

  // Remover campos que não devem ser inseridos/atualizados
  delete formatted.id;
  delete formatted.created_at;
  delete formatted.updated_at;

  // Adicionar timestamp de atualização
  formatted.updated_at = new Date().toISOString();

  return formatted;
}