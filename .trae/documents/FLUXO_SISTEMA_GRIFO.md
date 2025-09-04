# 🔄 Fluxo Completo do Sistema Grifo Vistorias

> **Documentação técnica dos fluxos e processos do sistema multi-tenant de gestão de vistorias imobiliárias**

## 📋 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Fluxo Completo de Vistoria](#2-fluxo-completo-de-vistoria)
3. [Fluxos de Autenticação](#3-fluxos-de-autenticação)
4. [Sistema de Contestação](#4-sistema-de-contestação)
5. [Integração entre Componentes](#5-integração-entre-componentes)
6. [Fluxo de Dados e Sincronização](#6-fluxo-de-dados-e-sincronização)
7. [Diagramas de Processo](#7-diagramas-de-processo)

---

## 1. Visão Geral da Arquitetura

### 1.1 Arquitetura Multi-Tenant

O Sistema Grifo utiliza uma arquitetura multi-tenant com **isolamento por empresa**, permitindo que múltiplas empresas de vistoria utilizem a mesma infraestrutura de forma segura e isolada.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SISTEMA GRIFO VISTORIAS                     │
├─────────────────────────────────────────────────────────────────┤
│  TENANT A (Empresa 1)  │  TENANT B (Empresa 2)  │  TENANT C... │
├────────────────────────┼────────────────────────┼──────────────┤
│ • Portal Admin         │ • Portal Admin         │ • Portal...  │
│ • Portal Cliente       │ • Portal Cliente       │ • Portal...  │
│ • App Mobile          │ • App Mobile          │ • App...     │
│ • Dados Isolados      │ • Dados Isolados      │ • Dados...   │
└────────────────────────┴────────────────────────┴──────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API BACKEND     │
                    │  (Multi-Tenant)   │
                    └─────────┬─────────┘
                              │
                    ┌─────────┴─────────┐
                    │  SUPABASE DB      │
                    │ (PostgreSQL+RLS)  │
                    └───────────────────┘
```

### 1.2 Componentes Principais

| Componente | Tecnologia | Função | Porta |
|------------|------------|--------|---------|
| **API Backend** | Node.js + Express | Lógica de negócio e autenticação | 3001 |
| **Portal Admin** | Next.js 14 | Interface administrativa | 3000 |
| **Portal Cliente** | Next.js 14 | Interface para clientes | 3000 |
| **App Mobile** | React Native + Expo | Aplicativo para vistoriadores | - |
| **Banco de Dados** | Supabase (PostgreSQL) | Armazenamento com RLS | - |
| **Storage** | Supabase Storage | Arquivos e imagens | - |

### 1.3 Isolamento Multi-Tenant

**Estratégia**: Cada empresa possui um `empresa_id` único que é usado para filtrar todos os dados.

**Row Level Security (RLS)**: Políticas automáticas garantem que cada tenant só acesse seus próprios dados.

```sql
-- Exemplo de política RLS
CREATE POLICY "tenant_isolation" ON vistorias
  FOR ALL USING (
    empresa_id = (auth.jwt() ->> 'empresa_id')::uuid
  );
```

---

## 2. Fluxo Completo de Vistoria

### 2.1 Ciclo de Vida de uma Vistoria

```
[CRIAÇÃO] → [ATRIBUIÇÃO] → [EXECUÇÃO] → [REVISÃO] → [ENTREGA] → [CONTESTAÇÃO?]
```

### 2.2 Fluxo Detalhado

#### **Fase 1: Criação da Solicitação**

**Portal do Cliente:**
1. Cliente faz login no portal (`/cliente/login`)
2. Acessa "Nova Solicitação" (`/cliente/nova-solicitacao`)
3. Preenche formulário:
   - Endereço do imóvel
   - Tipo de vistoria
   - Data preferencial
   - Observações
4. Sistema cria registro na tabela `inspection_requests`
5. Status inicial: `"pendente"`

**Portal Administrativo:**
1. Gestor visualiza solicitações em `/solicitacoes`
2. Pode aprovar, rejeitar ou solicitar mais informações
3. Se aprovada, cria vistoria na tabela `vistorias`
4. Status: `"pendente"` → `"aprovada"`

#### **Fase 2: Atribuição do Vistoriador**

**Portal Administrativo:**
1. Gestor acessa `/vistorias`
2. Seleciona vistoria pendente
3. Atribui vistoriador disponível
4. Sistema atualiza `app_vistoriador_id`
5. Status: `"aprovada"` → `"atribuida"`
6. Notificação enviada ao vistoriador

#### **Fase 3: Execução da Vistoria**

**App Mobile:**
1. Vistoriador faz login no app
2. Visualiza vistorias atribuídas na aba "Vistorias"
3. Seleciona vistoria e inicia execução
4. Status: `"atribuida"` → `"em_andamento"`
5. Processo de vistoria:
   - Captura fotos dos ambientes
   - Preenche formulários de avaliação
   - Registra observações
   - Coleta coordenadas GPS
6. Dados salvos localmente (offline-first)
7. Sincronização automática quando online
8. Finaliza vistoria
9. Status: `"em_andamento"` → `"concluida"`

#### **Fase 4: Revisão e Aprovação**

**Portal Administrativo:**
1. Gestor visualiza vistorias concluídas
2. Revisa relatório e fotos
3. Pode:
   - Aprovar: Status → `"aprovada"`
   - Solicitar correções: Status → `"revisao"`
   - Rejeitar: Status → `"rejeitada"`

#### **Fase 5: Geração e Entrega do Laudo**

**Sistema Automático:**
1. Gera PDF do laudo com:
   - Dados da vistoria
   - Fotos organizadas
   - Observações técnicas
   - QR Code para contestação
2. Salva no Supabase Storage
3. Envia notificação ao cliente
4. Status: `"aprovada"` → `"entregue"`

#### **Fase 6: Contestação (Opcional)**

**Sistema Público:**
1. Cliente/interessado acessa link do QR Code
2. Página pública `/contestar/[token]`
3. Preenche formulário de contestação
4. Upload de evidências (fotos/documentos)
5. Sistema registra contestação
6. Notifica empresa responsável

---

## 3. Fluxos de Autenticação

### 3.1 Autenticação de Gestores (Portal Admin)

```
[Login] → [Validação] → [JWT] → [Middleware] → [Dashboard]
```

**Processo Detalhado:**

1. **Login** (`/login`):
   ```typescript
   POST /api/v1/auth/portal/login
   {
     "email": "gestor@empresa.com",
     "password": "senha123"
   }
   ```

2. **Validação Backend**:
   - Verifica credenciais na tabela `portal_users`
   - Valida se usuário está ativo
   - Verifica empresa associada

3. **Geração JWT**:
   ```javascript
   const token = jwt.sign({
     user_id: user.id,
     empresa_id: user.empresa_id,
     role: user.role,
     permissions: user.permissions
   }, JWT_SECRET);
   ```

4. **Middleware de Proteção**:
   ```typescript
   // middleware.ts
   if (!token) redirect('/login');
   if (protectedRoute && !validToken) redirect('/login');
   ```

5. **Acesso ao Dashboard**:
   - Token armazenado em cookie httpOnly
   - Middleware valida em cada requisição
   - RLS filtra dados por empresa

### 3.2 Autenticação de Clientes (Portal Cliente)

```
[Registro] → [Verificação] → [Login] → [Sessão] → [Dashboard]
```

**Processo Detalhado:**

1. **Registro** (`/cliente/registro`):
   ```typescript
   POST /api/clients/register
   {
     "name": "João Silva",
     "email": "joao@email.com",
     "password": "senha123",
     "phone": "11999999999"
   }
   ```

2. **Criação de Conta**:
   - Hash da senha com bcrypt
   - Registro na tabela `clients`
   - Criação de sessão inicial

3. **Login** (`/cliente/login`):
   ```typescript
   POST /api/clients/login
   {
     "email": "joao@email.com",
     "password": "senha123"
   }
   ```

4. **Sessão de Cliente**:
   - Token JWT específico para clientes
   - Armazenado em localStorage e cookie
   - Renovação automática

### 3.3 Autenticação de Vistoriadores (App Mobile)

```
[Login] → [Biometria?] → [Token] → [Sincronização] → [Offline Cache]
```

**Processo Detalhado:**

1. **Login no App**:
   ```typescript
   POST /api/v1/auth/app/login
   {
     "email": "vistoriador@empresa.com",
     "password": "senha123"
   }
   ```

2. **Validação e Token**:
   - Verifica na tabela `app_users`
   - Gera JWT com permissões específicas
   - Inclui empresa_id para isolamento

3. **Cache Offline**:
   - Token salvo no SecureStore
   - Dados essenciais em cache local
   - Biometria para acesso rápido

4. **Sincronização**:
   - Dados locais sincronizados quando online
   - Conflitos resolvidos automaticamente

---

## 4. Sistema de Contestação

### 4.1 Geração do Link de Contestação

```
[Vistoria Concluída] → [Gerar Token] → [QR Code] → [Incluir no Laudo]
```

**Processo:**

1. **Geração Automática**:
   ```javascript
   // Quando vistoria é aprovada
   const contestToken = crypto.randomUUID();
   const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias
   
   await supabase.from('contest_links').insert({
     vistoria_id: vistoria.id,
     empresa_id: vistoria.empresa_id,
     token: contestToken,
     expires_at: expiresAt
   });
   ```

2. **QR Code no Laudo**:
   - URL: `https://sistema.com/contestar/${token}`
   - QR Code gerado automaticamente
   - Incluído no PDF do laudo

### 4.2 Fluxo de Contestação

```
[Scan QR] → [Página Pública] → [Formulário] → [Upload] → [Notificação]
```

**Processo Detalhado:**

1. **Acesso Público** (`/contestar/[token]`):
   - Página acessível sem login
   - Validação do token
   - Verificação de expiração

2. **Formulário de Contestação**:
   ```typescript
   {
     "contestant_name": "Maria Silva",
     "contestant_email": "maria@email.com",
     "contestant_phone": "11888888888",
     "reason": "Discordo da avaliação do banheiro",
     "description": "O banheiro estava em perfeito estado...",
     "evidence_files": ["foto1.jpg", "documento.pdf"]
   }
   ```

3. **Processamento**:
   - Upload de arquivos para Supabase Storage
   - Registro na tabela `contestations`
   - Marca token como usado
   - Notifica empresa responsável

4. **Notificação à Empresa**:
   - Email automático para gestores
   - Notificação no portal administrativo
   - Status da vistoria: `"contestada"`

---

## 5. Integração entre Componentes

### 5.1 API Backend como Hub Central

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Portal Web  │◄──►│ API Backend │◄──►│ App Mobile  │
└─────────────┘    └──────┬──────┘    └─────────────┘
                          │
                   ┌──────▼──────┐
                   │ Supabase DB │
                   └─────────────┘
```

### 5.2 Comunicação entre Componentes

#### **Portal Web ↔ API**

```typescript
// lib/api.ts
class ApiService {
  async getInspections(filters) {
    return fetch(`${API_URL}/api/v1/tenants/${tenant}/inspections`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenantId
      }
    });
  }
}
```

#### **App Mobile ↔ API**

```typescript
// services/grifoApi.ts
class GrifoApiService {
  async syncInspections() {
    const localData = await getLocalInspections();
    const serverData = await this.getInspections();
    
    // Resolve conflitos e sincroniza
    return await this.mergeData(localData, serverData);
  }
}
```

#### **API ↔ Supabase**

```javascript
// Middleware de tenant
const tenantMiddleware = (req, res, next) => {
  const empresaId = req.user.empresa_id;
  req.supabase = supabase.from('vistorias')
    .select('*')
    .eq('empresa_id', empresaId);
  next();
};
```

### 5.3 Fluxo de Dados em Tempo Real

```
[Ação no App] → [API] → [Supabase] → [Realtime] → [Portal Web]
```

**Exemplo - Atualização de Status:**

1. **App Mobile**: Vistoriador finaliza vistoria
2. **API**: Recebe PUT `/inspections/:id`
3. **Supabase**: Atualiza status na tabela
4. **Realtime**: Notifica subscribers
5. **Portal Web**: Atualiza interface automaticamente

---

## 6. Fluxo de Dados e Sincronização

### 6.1 Estratégia Offline-First (App Mobile)

```
[Ação Local] → [Cache SQLite] → [Queue Sync] → [API] → [Supabase]
```

**Implementação:**

```typescript
// services/offline.ts
class OfflineService {
  async saveInspection(data) {
    // 1. Salva localmente
    await SQLite.insertInspection(data);
    
    // 2. Adiciona à fila de sincronização
    await SyncQueue.add('inspection_update', data);
    
    // 3. Tenta sincronizar se online
    if (await NetInfo.isConnected()) {
      await this.syncPendingChanges();
    }
  }
}
```

### 6.2 Resolução de Conflitos

**Estratégia**: Last-Write-Wins com timestamp

```typescript
const resolveConflict = (local, server) => {
  if (local.updated_at > server.updated_at) {
    return local; // Dados locais mais recentes
  }
  return server; // Dados do servidor mais recentes
};
```

### 6.3 Sincronização de Arquivos

```
[Foto Capturada] → [Compressão] → [Cache Local] → [Upload Supabase] → [URL Atualizada]
```

**Processo:**

1. **Captura**: Foto salva localmente
2. **Otimização**: Compressão automática
3. **Upload**: Quando online, envia para Supabase Storage
4. **Referência**: Atualiza URL na base de dados

---

## 7. Diagramas de Processo

### 7.1 Fluxo Completo de Vistoria

```
┌─────────────┐
│   CLIENTE   │
│ Cria Solic. │
└──────┬──────┘
       │
       ▼
┌─────────────┐    ┌─────────────┐
│   GESTOR    │───►│  VISTORIA   │
│ Aprova Solic│    │  CRIADA     │
└─────────────┘    └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   GESTOR    │
                   │ Atribui Vist│
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │VISTORIADOR  │
                   │ Executa     │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   GESTOR    │
                   │ Revisa      │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   SISTEMA   │
                   │ Gera Laudo  │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   CLIENTE   │
                   │ Recebe Laudo│
                   └─────────────┘
```

### 7.2 Arquitetura de Autenticação

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Portal Web  │    │ App Mobile  │    │ Portal Cli  │
│ (Gestores)  │    │(Vistoriad.) │    │ (Clientes)  │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                API BACKEND                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │Auth Portal  │ │ Auth App    │ │ Auth Client │   │
│  │/portal/login│ │ /app/login  │ │/client/login│   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
              ┌─────────────┐
              │ SUPABASE    │
              │ • portal_users
              │ • app_users │
              │ • clients   │
              └─────────────┘
```

### 7.3 Fluxo de Sincronização (App Mobile)

```
┌─────────────┐
│ AÇÃO LOCAL  │
│ (Offline)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ SQLITE      │
│ Cache Local │
└──────┬──────┘
       │
       ▼
┌─────────────┐    ┌─────────────┐
│ SYNC QUEUE  │───►│ NETWORK?    │
│ Fila Pend.  │    │ Online?     │
└─────────────┘    └──────┬──────┘
                          │ Sim
                          ▼
                   ┌─────────────┐
                   │ API SYNC    │
                   │ Upload Data │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ SUPABASE    │
                   │ Persist DB  │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ REALTIME    │
                   │ Notify Web  │
                   └─────────────┘
```

---

## 📊 Métricas e Monitoramento

### Pontos de Monitoramento

- **API Response Time**: < 200ms para 95% das requisições
- **Sync Success Rate**: > 99% de sincronizações bem-sucedidas
- **Offline Capability**: App funcional por até 7 dias offline
- **File Upload Success**: > 98% de uploads de fotos bem-sucedidos
- **Authentication Success**: > 99.5% de logins bem-sucedidos

### Logs Importantes

- Tentativas de login falhadas
- Erros de sincronização
- Falhas no upload de arquivos
- Violações de RLS (tentativas de acesso cross-tenant)
- Performance de queries lentas

---

**Documento criado em:** Janeiro 2025  
**Versão:** 1.0  
**Última atualização:** Janeiro 2025

---

*Este documento detalha todos os fluxos e processos do Sistema Grifo Vistorias. Para dúvidas técnicas ou atualizações, consulte a equipe de desenvolvimento.*