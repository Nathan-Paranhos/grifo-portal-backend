# Edge Functions - Grifo Mobile API

Este diretório contém as Edge Functions do Supabase para a API Grifo Mobile. Cada função é implementada em TypeScript/Deno e fornece funcionalidades específicas para o sistema multi-tenant.

## Estrutura das Functions

```
functions/
├── create-tenant/          # Criação de novos tenants
├── assign-role/            # Atribuição de papéis a usuários
├── generate-pdf/           # Geração de PDFs de vistorias
├── dashboard-kpis/         # KPIs para dashboard
├── usage-stats/            # Estatísticas de uso
├── auth-bridge/            # Bridge de autenticação
└── drive-sync/             # Sincronização com Google Drive
```

## Functions Disponíveis

### 1. create-tenant

**Endpoint:** `POST /functions/v1/create-tenant`

**Descrição:** Cria um novo tenant (empresa) no sistema.

**Permissões:** Apenas `superadmin`

**Payload:**
```json
{
  "nome": "Nome da Empresa",
  "cnpj": "12345678000199" // opcional
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-da-empresa",
    "nome": "Nome da Empresa",
    "cnpj": "12345678000199",
    "ativa": true,
    "storage_mb": 0,
    "created_at": "2024-01-01T00:00:00Z"
  },
  "message": "Empresa criada com sucesso"
}
```

**Exemplo de uso:**
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/create-tenant" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Minha Empresa", "cnpj": "12345678000199"}'
```

### 2. assign-role

**Endpoint:** `POST /functions/v1/assign-role`

**Descrição:** Atribui um papel específico a um usuário em uma empresa.

**Permissões:** Apenas `superadmin`

**Payload:**
```json
{
  "user_id": "uuid-do-usuario",
  "role": "admin", // superadmin, admin, corretor, leitura
  "empresa_id": "uuid-da-empresa"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-do-usuario",
    "email": "user@empresa.com",
    "nome": "Nome do Usuário",
    "role": "admin",
    "empresa_id": "uuid-da-empresa"
  },
  "message": "Papel atribuído com sucesso"
}
```

### 3. generate-pdf

**Endpoint:** `POST /functions/v1/generate-pdf`

**Descrição:** Gera um PDF para uma vistoria específica.

**Permissões:** Usuários da mesma empresa da vistoria ou `superadmin`

**Payload:**
```json
{
  "vistoria_id": "uuid-da-vistoria"
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "pdf_url": "https://storage.supabase.co/path/to/pdf",
    "vistoria_id": "uuid-da-vistoria"
  },
  "message": "PDF gerado com sucesso"
}
```

### 4. dashboard-kpis

**Endpoint:** `GET /functions/v1/dashboard-kpis`

**Descrição:** Retorna KPIs para o dashboard.

**Permissões:** `admin` ou `superadmin`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "total_vistorias": 150,
    "vistorias_concluidas": 120,
    "vistorias_pendentes": 30,
    "total_imoveis": 85,
    "total_usuarios": 12,
    "storage_utilizado_mb": 245.6
  }
}
```

### 5. usage-stats

**Endpoint:** `GET /functions/v1/usage-stats`

**Descrição:** Retorna estatísticas detalhadas de uso do sistema.

**Permissões:** `admin` ou `superadmin`

**Resposta:**
```json
{
  "success": true,
  "data": {
    "resumo": {
      "total_storage_mb": 1024.5,
      "total_usuarios": 45,
      "total_vistorias": 320,
      "total_imoveis": 180
    },
    "usuarios_por_role": {
      "admin": 5,
      "corretor": 25,
      "leitura": 15
    },
    "vistorias_por_status": {
      "pendente": 45,
      "em_andamento": 30,
      "concluida": 245
    },
    "tendencias_30_dias": {
      "novas_vistorias": 25,
      "pdfs_gerados": 40,
      "novos_usuarios": 3
    }
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "scope": "empresa" // ou "global" para superadmin
}
```

### 6. auth-bridge

**Endpoint:** `POST /functions/v1/auth-bridge`

**Descrição:** Bridge para integração com sistemas de autenticação externos.

**Uso interno:** Chamado automaticamente durante o processo de autenticação.

### 7. drive-sync

**Endpoint:** Webhook interno

**Descrição:** Sincroniza PDFs gerados com Google Drive.

**Trigger:** Automático quando um PDF é gerado.

## Desenvolvimento

### Pré-requisitos

- Deno 1.37+
- Supabase CLI
- Variáveis de ambiente configuradas

### Executar localmente

```bash
# Servir todas as functions
supabase functions serve

# Servir uma function específica
supabase functions serve create-tenant

# Com logs detalhados
supabase functions serve --debug
```



### Deploy

```bash
# Deploy todas as functions
supabase functions deploy

# Deploy function específica
supabase functions deploy create-tenant

# Deploy com verificação
supabase functions deploy --verify-jwt
```

## Estrutura de uma Function

Cada function segue a estrutura padrão:

```
function-name/
├── index.ts        # Código principal

└── README.md       # Documentação específica
```

### Template básico

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autorização necessário' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Lógica da function
    const result = await processRequest(req, supabase);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processRequest(req: Request, supabase: any) {
  // Implementar lógica específica
}
```

## Segurança

### Autenticação

Todas as functions verificam o JWT token no header `Authorization`:

```typescript
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  throw new Error('Token de autorização necessário');
}
```

### Autorização

Verificação de papéis baseada nos claims do JWT:

```typescript
const { data: { user } } = await supabase.auth.getUser();
const userRole = user?.app_metadata?.role;

if (userRole !== 'superadmin') {
  throw new Error('Acesso negado');
}
```

### Validação de dados

Uso do Zod para validação:

```typescript
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const schema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().optional()
});

const validatedData = schema.parse(requestData);
```

## Monitoramento

### Logs

Todas as functions incluem logging estruturado:

```typescript
console.log('Function executada:', {
  function: 'create-tenant',
  user_id: user.id,
  timestamp: new Date().toISOString(),
  data: { nome: validatedData.nome }
});
```

### Métricas

Métricas são coletadas automaticamente pelo Supabase:

- Número de execuções
- Tempo de resposta
- Taxa de erro
- Uso de recursos

### Alertas

Configurar alertas para:

- Taxa de erro > 5%
- Tempo de resposta > 5s
- Falhas de autenticação

## Troubleshooting

### Problemas comuns

1. **Erro 401 - Unauthorized**
   - Verificar se o token JWT está sendo enviado
   - Verificar se o token não expirou
   - Verificar configuração do SUPABASE_JWT_SECRET

2. **Erro 403 - Forbidden**
   - Verificar se o usuário tem o papel necessário
   - Verificar se as políticas RLS estão corretas

3. **Erro 500 - Internal Server Error**
   - Verificar logs da function
   - Verificar variáveis de ambiente
   - Verificar conectividade com banco de dados

### Debug

```bash
# Visualizar logs em tempo real
supabase functions logs --function-name create-tenant

# Logs com filtro
supabase functions logs --function-name create-tenant --level error
```

## Contribuição

1. Criar branch para nova feature
2. Implementar function seguindo o template

4. Atualizar documentação
5. Criar pull request

### Checklist para nova function

- [ ] Implementação seguindo template
- [ ] Validação de entrada com Zod
- [ ] Verificação de autenticação/autorização
- [ ] Tratamento de erros

- [ ] Documentação atualizada
- [ ] CORS configurado
- [ ] Logs estruturados