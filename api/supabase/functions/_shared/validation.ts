import { z } from 'zod';

/**
 * Schemas de validação para as Edge Functions
 */

// Schema para UUID
export const uuidSchema = z.string().uuid('UUID inválido');

// Schema para email
export const emailSchema = z.string().email('Email inválido');

// Schema para CNPJ (formato brasileiro)
export const cnpjSchema = z
  .string()
  .regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, 'CNPJ inválido')
  .optional();

// Schema para role
export const roleSchema = z.enum(['superadmin', 'admin', 'corretor', 'leitura']);

// Schema para status de vistoria
export const vistoriaStatusSchema = z.enum([
  'pendente',
  'em_andamento', 
  'concluida',
  'cancelada'
]);

// Schema para status de contestação
export const contestacaoStatusSchema = z.enum([
  'aberta',
  'em_analise',
  'aprovada',
  'rejeitada',
  'fechada'
]);

/**
 * Schemas para criação de tenant
 */
export const createTenantSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  cnpj: cnpjSchema,
});

/**
 * Schemas para atribuição de papel
 */
export const assignRoleSchema = z.object({
  user_id: uuidSchema,
  role: roleSchema,
  empresa_id: uuidSchema,
});

/**
 * Schemas para geração de PDF
 */
export const generatePdfSchema = z.object({
  vistoria_id: uuidSchema,
});

/**
 * Schemas para criação de usuário
 */
export const createUserSchema = z.object({
  email: emailSchema,
  nome: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  role: roleSchema.default('leitura'),
  empresa_id: uuidSchema,
});

/**
 * Schemas para criação de imóvel
 */
export const enderecoSchema = z.object({
  logradouro: z.string().min(1, 'Logradouro é obrigatório'),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().min(1, 'Bairro é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Estado deve ter 2 caracteres'),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido'),
});

export const pessoaSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  cpf: z.string().regex(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, 'CPF inválido').optional(),
  telefone: z.string().optional(),
  email: emailSchema.optional(),
});

export const createImovelSchema = z.object({
  empresa_id: uuidSchema,
  endereco: enderecoSchema,
  proprietario: pessoaSchema,
  inquilino: pessoaSchema.optional(),
});

/**
 * Schemas para criação de vistoria
 */
export const createVistoriaSchema = z.object({
  empresa_id: uuidSchema,
  imovel_id: uuidSchema,
  responsavel_id: uuidSchema,
  status: vistoriaStatusSchema.default('pendente'),
});

/**
 * Schemas para criação de contestação
 */
export const createContestacaoSchema = z.object({
  vistoria_id: uuidSchema,
  autor_id: uuidSchema,
  justificativa: z
    .string()
    .min(10, 'Justificativa deve ter pelo menos 10 caracteres')
    .max(1000, 'Justificativa deve ter no máximo 1000 caracteres'),
  status: contestacaoStatusSchema.default('aberta'),
  anexos: z.array(z.object({
    nome: z.string(),
    url: z.string().url(),
    tipo: z.string(),
    tamanho: z.number().positive(),
  })).optional(),
});

/**
 * Schemas para paginação
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Schemas para filtros
 */
export const dateRangeSchema = z.object({
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
});

export const vistoriaFiltersSchema = z.object({
  status: vistoriaStatusSchema.optional(),
  responsavel_id: uuidSchema.optional(),
  imovel_id: uuidSchema.optional(),
  ...dateRangeSchema.shape,
});

export const contestacaoFiltersSchema = z.object({
  status: contestacaoStatusSchema.optional(),
  autor_id: uuidSchema.optional(),
  vistoria_id: uuidSchema.optional(),
  ...dateRangeSchema.shape,
});

/**
 * Utilitários de validação
 */

/**
 * Valida dados de entrada usando um schema Zod
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Dados inválidos: ${messages}`);
    }
    throw error;
  }
}

/**
 * Valida dados de entrada de forma assíncrona
 */
export async function validateInputAsync<T>(
  schema: z.ZodSchema<T>, 
  data: unknown
): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw new Error(`Dados inválidos: ${messages}`);
    }
    throw error;
  }
}

/**
 * Valida query parameters de uma URL
 */
export function validateQueryParams<T>(
  schema: z.ZodSchema<T>, 
  url: URL
): T {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  
  return validateInput(schema, params);
}

/**
 * Valida JSON do body de uma requisição
 */
export async function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  req: Request
): Promise<T> {
  try {
    const body = await req.json();
    return validateInput(schema, body);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('JSON inválido no body da requisição');
    }
    throw error;
  }
}

/**
 * Sanitiza string removendo caracteres especiais
 */
export function sanitizeString(str: string): string {
  return str
    .trim()
    .replace(/[<>"'&]/g, '') // Remove caracteres perigosos
    .substring(0, 1000); // Limita tamanho
}

/**
 * Valida e sanitiza CNPJ
 */
export function sanitizeCNPJ(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

/**
 * Valida e sanitiza CPF
 */
export function sanitizeCPF(cpf: string): string {
  return cpf.replace(/[^\d]/g, '');
}

/**
 * Valida se uma data está no futuro
 */
export const futureDateSchema = z
  .string()
  .datetime()
  .refine(
    (date) => new Date(date) > new Date(),
    'Data deve estar no futuro'
  );

/**
 * Valida se uma data está no passado
 */
export const pastDateSchema = z
  .string()
  .datetime()
  .refine(
    (date) => new Date(date) < new Date(),
    'Data deve estar no passado'
  );

/**
 * Schema para validação de arquivo
 */
export const fileSchema = z.object({
  name: z.string().min(1, 'Nome do arquivo é obrigatório'),
  size: z.number().positive('Tamanho do arquivo deve ser positivo'),
  type: z.string().min(1, 'Tipo do arquivo é obrigatório'),
  url: z.string().url('URL do arquivo inválida').optional(),
});

/**
 * Schema para validação de múltiplos arquivos
 */
export const filesSchema = z
  .array(fileSchema)
  .max(10, 'Máximo de 10 arquivos permitidos');

/**
 * Valida tamanho máximo de arquivo (em bytes)
 */
export function validateFileSize(size: number, maxSizeMB: number = 10): void {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (size > maxSizeBytes) {
    throw new Error(`Arquivo muito grande. Máximo permitido: ${maxSizeMB}MB`);
  }
}

/**
 * Valida tipos de arquivo permitidos
 */
export function validateFileType(
  type: string, 
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'application/pdf']
): void {
  if (!allowedTypes.includes(type)) {
    throw new Error(
      `Tipo de arquivo não permitido. Tipos aceitos: ${allowedTypes.join(', ')}`
    );
  }
}