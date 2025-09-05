# Proposta de Melhorias - Sistema de Tenant Dinâmico para Clientes

## Objetivo

Implementar um sistema completo de tenant para clientes que permita:
1. Admin criar usuários clientes associados ao seu tenant
2. Clientes acessarem o portal com tenant específico via URL
3. Isolamento completo de dados por tenant
4. Fluxo seguro e intuitivo para ambos os perfis

## Implementação Proposta

### 1. Modificações no Portal Administrativo

#### 1.1 Nova Página de Criação de Cliente
**Arquivo**: `portal-web/app/(protected)/clientes/criar/page.tsx`

```typescript
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { grifoPortalApiService } from '@/lib/api';

interface CreateClientForm {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

export default function CreateClientPage() {
  const [formData, setFormData] = useState<CreateClientForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Senhas não coincidem');
      setLoading(false);
      return;
    }

    try {
      const response = await grifoPortalApiService.createClient({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password
      });

      if (response.success) {
        router.push('/clientes?created=true');
      } else {
        setError(response.error || 'Erro ao criar cliente');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Criar Novo Cliente</h1>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            className="w-full p-2 border rounded-lg"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({...formData, phone: e.target.value})}
            className="w-full p-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Senha</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            className="w-full p-2 border rounded-lg"
            required
            minLength={6}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Confirmar Senha</label>
          <input
            type="password"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
            className="w-full p-2 border rounded-lg"
            required
            minLength={6}
          />
        </div>
        
        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}
        
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Criando...' : 'Criar Cliente'}
          </button>
          
          <button
            type="button"
            onClick={() => router.back()}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
          >
            Cancelar
          </button>
        </div>
      </form>
      
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Informações de Acesso</h3>
        <p className="text-sm text-blue-700">
          Após criar o cliente, ele poderá acessar o portal através do link:
        </p>
        <code className="text-xs bg-blue-100 p-1 rounded mt-1 block">
          http://localhost:3015/cliente/login?tenant={grifoPortalApiService.getTenant()}
        </code>
      </div>
    </div>
  );
}
```

#### 1.2 Atualizar API Service
**Arquivo**: `portal-web/lib/api.ts`

Adicionar método para criar cliente:

```typescript
// Adicionar ao GrifoPortalApiService
async createClient(clientData: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<ApiResponse<any>> {
  return this.makeRequest<any>(`${this.getTenantPath()}/clients`, {
    method: 'POST',
    body: JSON.stringify(clientData)
  });
}

// Método para obter tenant atual
getTenant(): string {
  return this.tenant;
}
```

### 2. Modificações no Portal do Cliente

#### 2.1 Detecção de Tenant por URL
**Arquivo**: `portal-web/lib/client-api.ts`

```typescript
class ClientApiService {
  private baseUrl: string;
  private tenant: string | null = null;

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://grifo-api-backend.onrender.com' 
      : 'http://localhost:10000';
    
    // Detectar tenant da URL
    this.detectTenant();
  }

  private detectTenant(): void {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tenantFromUrl = urlParams.get('tenant');
      
      if (tenantFromUrl) {
        this.tenant = tenantFromUrl;
        // Salvar tenant no localStorage para próximas requisições
        localStorage.setItem('client_tenant', tenantFromUrl);
      } else {
        // Tentar recuperar tenant salvo
        this.tenant = localStorage.getItem('client_tenant');
      }
    }
  }

  private getClientPath(): string {
    if (this.tenant) {
      return `/api/v1/tenants/${this.tenant}/clients`;
    }
    return '/api/v1/clients'; // Fallback para compatibilidade
  }

  // Atualizar métodos existentes para usar getClientPath()
  async login(email: string, password: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${this.baseUrl}${this.getClientPath()}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      this.saveAuthToken(data.data.token);
      return { success: true, data: data.data };
    }
    
    return { success: false, error: data.message || 'Erro no login' };
  }

  // Método para obter URL de acesso com tenant
  getLoginUrl(tenant: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/cliente/login?tenant=${tenant}`;
  }
}
```

#### 2.2 Middleware para Validar Tenant
**Arquivo**: `portal-web/middleware.ts`

Adicionar validação de tenant para rotas de cliente:

```typescript
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Verificar rotas de cliente
  if (pathname.startsWith('/cliente/') && pathname !== '/cliente/login') {
    const tenant = searchParams.get('tenant');
    
    if (!tenant) {
      // Redirecionar para login se não houver tenant
      return NextResponse.redirect(new URL('/cliente/login', request.url));
    }
  }
  
  // ... resto do middleware existente
}
```

### 3. Modificações na API Backend

#### 3.1 Nova Rota para Criação de Cliente por Admin
**Arquivo**: `api/src/routes/v1/users.js`

Adicionar rota para admin criar cliente:

```javascript
/**
 * @swagger
 * /api/v1/tenants/{tenant}/clients:
 *   post:
 *     tags: [Clients]
 *     summary: Criar cliente (apenas admin)
 *     parameters:
 *       - in: path
 *         name: tenant
 *         required: true
 *         schema:
 *           type: string
 */
router.post(
  '/clients',
  authSupabase,
  requireTenantRole(['admin', 'super_admin']),
  asyncHandler(async (req, res) => {
    const { name, email, phone, password } = req.body;
    const companyId = req.company.id;

    // Verificar se email já existe
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .eq('company_id', companyId)
      .single();

    if (existingClient) {
      throw new ValidationError('Email já cadastrado para esta empresa');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar cliente
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        name,
        email: email.toLowerCase(),
        phone,
        password: hashedPassword,
        company_id: companyId,
        status: 'active',
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) {
      throw new AppError('Erro ao criar cliente', 500);
    }

    // Remover senha da resposta
    const { password: _, ...clientData } = client;

    res.status(201).json({
      success: true,
      message: 'Cliente criado com sucesso',
      data: {
        client: clientData,
        loginUrl: `${process.env.FRONTEND_URL}/cliente/login?tenant=${req.company.slug}`
      }
    });
  })
);
```

#### 3.2 Modificar Rotas de Cliente para Suportar Tenant
**Arquivo**: `api/src/routes/v1/index.js`

Adicionar rotas de cliente com tenant:

```javascript
// Rotas de cliente com tenant (para isolamento)
router.use(
  '/tenants/:tenant/clients',
  authSupabase,
  resolveTenant,
  requireTenantAccess,
  clientRoutes
);

// Manter rotas antigas para compatibilidade
router.use('/clients', clientRoutes);
```

### 4. Melhorias de Segurança

#### 4.1 RLS (Row Level Security) no Supabase

```sql
-- Política para clientes acessarem apenas dados da própria empresa
CREATE POLICY "clients_company_isolation" ON clients
  FOR ALL USING (company_id = current_setting('app.current_company_id')::integer);

-- Política para solicitações de vistoria
CREATE POLICY "inspection_requests_company_isolation" ON inspection_requests
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE company_id = current_setting('app.current_company_id')::integer
    )
  );
```

#### 4.2 Middleware de Contexto de Empresa
**Arquivo**: `api/src/middleware/company-context.js`

```javascript
export const setCompanyContext = asyncHandler(async (req, res, next) => {
  if (req.company?.id) {
    // Definir contexto da empresa para RLS
    await supabase.rpc('set_config', {
      setting_name: 'app.current_company_id',
      setting_value: req.company.id.toString(),
      is_local: true
    });
  }
  next();
});
```

## Fluxo Completo Implementado

### 1. Admin cria cliente:
1. Admin faz login no portal administrativo
2. Navega para "Clientes" → "Criar Novo Cliente"
3. Preenche dados do cliente (nome, email, telefone, senha)
4. Sistema cria cliente associado ao tenant do admin
5. Sistema exibe URL de acesso para o cliente

### 2. Cliente acessa o portal:
1. Cliente recebe URL: `http://localhost:3015/cliente/login?tenant=empresa1`
2. Sistema detecta tenant da URL e configura API
3. Cliente faz login com suas credenciais
4. Sistema valida credenciais no contexto do tenant
5. Cliente acessa apenas dados da sua empresa

### 3. Isolamento garantido:
- Todas as requisições incluem tenant
- RLS no banco garante isolamento de dados
- Middleware valida acesso ao tenant
- URLs específicas por tenant

## Benefícios da Implementação

1. **Isolamento Completo**: Cada tenant tem seus próprios clientes isolados
2. **Segurança**: RLS e validações garantem que clientes não vejam dados de outras empresas
3. **Facilidade de Uso**: URLs específicas facilitam o acesso
4. **Escalabilidade**: Sistema suporta múltiplos tenants facilmente
5. **Compatibilidade**: Mantém rotas antigas funcionando

## Próximos Passos

1. Implementar as modificações propostas
2. Testar o fluxo completo
3. Configurar RLS no Supabase
4. Documentar o processo para usuários finais
5. Implementar monitoramento e logs de acesso por tenant