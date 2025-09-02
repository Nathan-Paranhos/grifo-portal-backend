# 📋 Guia Completo de Uso do Sistema Grifo

## 🎯 Visão Geral

O Sistema Grifo é uma plataforma completa para gestão de vistorias imobiliárias, composta por:
- **Portal Administrativo** - Gestão completa do sistema
- **Portal do Cliente** - Interface para solicitação de vistorias
- **API Backend** - Serviços e integração
- **App Mobile** - Aplicativo para vistoriadores
- **Banco de Dados** - Supabase PostgreSQL

---

## 🏢 Portal Administrativo (Next.js)

### 🚀 Acesso e Inicialização

```bash
# Navegar para o diretório
cd portal-web

# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Executar em produção
npm run build
npm start
```

**URL de Acesso:** `http://localhost:3000`

### 🔐 Autenticação

**Login Administrativo:**
- URL: `/login`
- Credenciais: Usuários cadastrados no sistema
- Autenticação via JWT + Supabase

### 📊 Funcionalidades Principais

#### 1. Dashboard Principal (`/dashboard`)
- **Estatísticas Gerais**
  - Total de vistorias
  - Vistorias pendentes
  - Vistorias em andamento
  - Vistorias concluídas
- **Gráficos de Performance**
  - Distribuição por status
  - Tendências mensais
  - Produtividade por vistoriador

#### 2. Gestão de Vistorias (`/vistorias`)
- **Listagem Completa**
  - Filtros por status, data, cliente
  - Busca por código ou endereço
  - Paginação automática
- **Ações Disponíveis**
  - Visualizar detalhes
  - Atribuir vistoriador
  - Alterar status
  - Exportar relatórios
  - Seleção múltipla para ações em lote

#### 3. Gestão de Clientes (`/clientes`)
- **Cadastro de Clientes**
  - Dados pessoais/empresariais
  - Informações de contato
  - Histórico de solicitações
- **Funcionalidades**
  - Busca e filtros avançados
  - Edição de dados
  - Visualização de histórico
  - Status de atividade

#### 4. Solicitações de Vistoria (`/solicitacoes`)
- **Gestão de Demandas**
  - Novas solicitações de clientes
  - Aprovação/rejeição
  - Atribuição de vistoriadores
  - Agendamento de visitas
- **Filtros e Busca**
  - Por status (pendente, aprovada, rejeitada)
  - Por cliente
  - Por data de solicitação
  - Por tipo de imóvel

#### 5. Gestão de Usuários (`/usuarios`)
- **Administração de Acesso**
  - Cadastro de vistoriadores
  - Definição de permissões
  - Controle de status (ativo/inativo)
  - Histórico de atividades

#### 6. Contestações (`/contestoes`)
- **Gestão de Recursos**
  - Visualização de contestações
  - Análise de documentos
  - Aprovação/rejeição
  - Comunicação com clientes

#### 7. Relatórios e Análises (`/usage`)
- **Relatórios Gerenciais**
  - Uso do sistema por empresa
  - Performance de vistoriadores
  - Estatísticas de produtividade
  - Exportação em CSV/Excel

### 🛠️ Configurações do Sistema

**Variáveis de Ambiente (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=https://fsvwifbvehdhlufauahj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_GRIFO_API_URL=http://localhost:10000
NEXT_PUBLIC_DEMO_MODE=false
```

---

## 👥 Portal do Cliente

### 🚀 Acesso e Funcionalidades

**URLs do Cliente:**
- Login: `/cliente/login`
- Registro: `/cliente/registro`
- Dashboard: `/cliente/dashboard`
- Nova Solicitação: `/cliente/nova-solicitacao`

### 🔐 Sistema de Autenticação

#### Registro de Cliente (`/cliente/registro`)
```typescript
// Campos obrigatórios
{
  nome: string,
  email: string,
  senha: string,
  telefone?: string,
  tipo_pessoa: 'fisica' | 'juridica',
  documento: string // CPF ou CNPJ
}
```

#### Login do Cliente (`/cliente/login`)
- Autenticação via email/senha
- Token JWT armazenado no localStorage
- Redirecionamento automático para dashboard

### 📋 Dashboard do Cliente (`/cliente/dashboard`)

#### Informações Exibidas
- **Dados do Cliente**
  - Nome e informações básicas
  - Status da conta
  - Último acesso

- **Estatísticas de Solicitações**
  - Total de solicitações
  - Pendentes
  - Em andamento
  - Concluídas

- **Lista de Solicitações**
  - Código da solicitação
  - Endereço do imóvel
  - Status atual
  - Data de criação
  - Link para detalhes

### 📝 Nova Solicitação (`/cliente/nova-solicitacao`)

#### Formulário de Solicitação
```typescript
{
  endereco: string,           // Endereço completo
  tipo_imovel: string,        // Residencial, comercial, etc.
  data_preferencial: Date,    // Data desejada para vistoria
  descricao?: string,         // Observações adicionais
  urgente: boolean           // Solicitação urgente
}
```

#### Processo de Criação
1. Preenchimento do formulário
2. Validação dos dados
3. Envio para API
4. Confirmação e redirecionamento

### 📄 Detalhes da Solicitação (`/cliente/solicitacao/[id]`)

#### Informações Disponíveis
- **Status da Solicitação**
  - Pendente análise
  - Aprovada
  - Vistoriador atribuído
  - Em andamento
  - Concluída
  - Laudo disponível

- **Dados da Vistoria**
  - Vistoriador responsável
  - Data agendada
  - Observações
  - Arquivos anexos

- **Download do Laudo**
  - Link direto para PDF
  - Histórico de downloads

---

## 🔧 API Backend (Node.js/Express)

### 🚀 Inicialização

```bash
# Navegar para o diretório
cd api

# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Executar em produção
npm start
```

**URL Base:** `http://localhost:10000`

### 🛣️ Estrutura de Rotas

#### Rotas de Autenticação (`/api/v1/auth`)
```http
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
```

#### Rotas de Clientes (`/api/v1/clients`)
```http
# Autenticação de Cliente
POST /api/v1/clients/register
POST /api/v1/clients/login
POST /api/v1/clients/logout

# Gestão de Perfil (Autenticado)
GET /api/v1/clients/profile
PUT /api/v1/clients/profile
DELETE /api/v1/clients/account
```

#### Rotas de Solicitações (`/api/v1/inspection-requests`)
```http
# Cliente Autenticado
POST /api/v1/inspection-requests          # Criar solicitação
GET /api/v1/inspection-requests           # Listar minhas solicitações
GET /api/v1/inspection-requests/:id       # Detalhes da solicitação
PUT /api/v1/inspection-requests/:id       # Atualizar solicitação
DELETE /api/v1/inspection-requests/:id    # Cancelar solicitação
```

#### Rotas Administrativas (`/api/v1/admin`)
```http
# Gestão de Solicitações
GET /api/v1/admin/inspection-requests     # Listar todas
PUT /api/v1/admin/inspection-requests/:id/status  # Alterar status
PUT /api/v1/admin/inspection-requests/:id/assign  # Atribuir vistoriador

# Gestão de Clientes
GET /api/v1/admin/clients                 # Listar clientes
GET /api/v1/admin/clients/:id             # Detalhes do cliente
PUT /api/v1/admin/clients/:id/status      # Alterar status
```

#### Rotas de Vistorias (`/api/v1/grifo/inspections`)
```http
GET /api/v1/grifo/inspections             # Listar vistorias
POST /api/v1/grifo/inspections            # Criar vistoria
GET /api/v1/grifo/inspections/:id         # Detalhes da vistoria
PUT /api/v1/grifo/inspections/:id         # Atualizar vistoria
DELETE /api/v1/grifo/inspections/:id      # Excluir vistoria

# Upload de arquivos
POST /api/v1/grifo/inspections/:id/files  # Upload de fotos/documentos
GET /api/v1/grifo/inspections/:id/files   # Listar arquivos
DELETE /api/v1/grifo/files/:fileId        # Excluir arquivo
```

#### Rotas de Relatórios (`/api/v1/reports`)
```http
GET /api/v1/reports/dashboard             # Dados do dashboard
GET /api/v1/reports/inspections           # Relatório de vistorias
GET /api/v1/reports/performance           # Relatório de performance
POST /api/v1/reports/export               # Exportar dados
```

### 🔐 Sistema de Autenticação

#### Middleware de Autenticação
```javascript
// Autenticação de usuário administrativo
authSupabase(req, res, next)

// Autenticação de cliente
authenticateClient(req, res, next)

// Autenticação opcional
optionalAuth(req, res, next)
```

#### Estrutura do Token JWT
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "role": "admin|vistoriador|cliente",
  "tenant_id": "grifo",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 📊 Validação de Dados (Zod)

#### Schema de Cliente
```javascript
const clientRegisterSchema = z.object({
  nome: z.string().min(2).max(100),
  email: z.string().email(),
  senha: z.string().min(6),
  telefone: z.string().optional(),
  tipo_pessoa: z.enum(['fisica', 'juridica']),
  documento: z.string().min(11).max(18)
});
```

#### Schema de Solicitação
```javascript
const inspectionRequestSchema = z.object({
  endereco: z.string().min(10).max(500),
  tipo_imovel: z.string().min(2).max(50),
  data_preferencial: z.string().datetime(),
  descricao: z.string().max(1000).optional(),
  urgente: z.boolean().default(false)
});
```

### 🛠️ Configuração da API

**Variáveis de Ambiente (.env):**
```env
# Servidor
PORT=10000
NODE_ENV=production

# Supabase
SUPABASE_URL=https://fsvwifbvehdhlufauahj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=http://localhost:3000,https://your-domain.com

# Tenant
DEFAULT_TENANT=grifo
```

---

## 🗄️ Banco de Dados (Supabase PostgreSQL)

### 🏗️ Estrutura Principal

#### Tabela: `empresas`
```sql
CREATE TABLE empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  email VARCHAR(100),
  telefone VARCHAR(20),
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabela: `usuarios`
```sql
CREATE TABLE usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id),
  empresa_id UUID REFERENCES empresas(id),
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'vistoriador',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabela: `clientes`
```sql
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,
  telefone VARCHAR(20),
  tipo_pessoa VARCHAR(10) CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  documento VARCHAR(18) UNIQUE NOT NULL,
  endereco TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabela: `client_sessions`
```sql
CREATE TABLE client_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  last_activity TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabela: `inspection_requests`
```sql
CREATE TABLE inspection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clientes(id),
  codigo VARCHAR(20) UNIQUE NOT NULL,
  endereco TEXT NOT NULL,
  tipo_imovel VARCHAR(50) NOT NULL,
  data_preferencial TIMESTAMP,
  descricao TEXT,
  urgente BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pendente',
  vistoriador_id UUID REFERENCES usuarios(id),
  vistoria_id UUID REFERENCES vistorias(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabela: `vistorias`
```sql
CREATE TABLE vistorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  endereco TEXT NOT NULL,
  tipo_imovel VARCHAR(50),
  cep VARCHAR(10),
  cidade VARCHAR(100),
  estado VARCHAR(2),
  vistoriador_id UUID REFERENCES usuarios(id),
  status VARCHAR(20) DEFAULT 'pendente',
  data_agendada TIMESTAMP,
  data_realizada TIMESTAMP,
  observacoes TEXT,
  laudo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabela: `inspection_files`
```sql
CREATE TABLE inspection_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vistoria_id UUID REFERENCES vistorias(id) ON DELETE CASCADE,
  nome_arquivo VARCHAR(255) NOT NULL,
  tipo_arquivo VARCHAR(50),
  tamanho_bytes BIGINT,
  url_storage TEXT NOT NULL,
  categoria VARCHAR(50), -- 'foto', 'documento', 'laudo'
  descricao TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 🔐 Políticas de Segurança (RLS)

#### Política para Clientes
```sql
-- Clientes só podem ver seus próprios dados
CREATE POLICY "Clientes podem ver próprios dados" ON clientes
  FOR SELECT USING (auth.uid()::text = id::text);

-- Clientes só podem atualizar próprios dados
CREATE POLICY "Clientes podem atualizar próprios dados" ON clientes
  FOR UPDATE USING (auth.uid()::text = id::text);
```

#### Política para Solicitações
```sql
-- Clientes só podem ver suas próprias solicitações
CREATE POLICY "Clientes podem ver próprias solicitações" ON inspection_requests
  FOR SELECT USING (client_id = auth.uid());

-- Clientes podem criar solicitações
CREATE POLICY "Clientes podem criar solicitações" ON inspection_requests
  FOR INSERT WITH CHECK (client_id = auth.uid());
```

### 📊 Índices para Performance

```sql
-- Índices para busca rápida
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_clientes_documento ON clientes(documento);
CREATE INDEX idx_inspection_requests_client ON inspection_requests(client_id);
CREATE INDEX idx_inspection_requests_status ON inspection_requests(status);
CREATE INDEX idx_vistorias_codigo ON vistorias(codigo);
CREATE INDEX idx_vistorias_vistoriador ON vistorias(vistoriador_id);
CREATE INDEX idx_client_sessions_token ON client_sessions(token_hash);
CREATE INDEX idx_client_sessions_expires ON client_sessions(expires_at);
```

### 🔄 Triggers e Funções

#### Geração Automática de Códigos
```sql
-- Função para gerar código de solicitação
CREATE OR REPLACE FUNCTION generate_inspection_request_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.codigo := 'SOL-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                LPAD(NEXTVAL('inspection_request_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para aplicar a função
CREATE TRIGGER trigger_generate_inspection_request_code
  BEFORE INSERT ON inspection_requests
  FOR EACH ROW EXECUTE FUNCTION generate_inspection_request_code();
```

#### Atualização de Timestamps
```sql
-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas relevantes
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspection_requests_updated_at
  BEFORE UPDATE ON inspection_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 🚀 Fluxo Completo do Sistema

### 1. Registro e Login do Cliente
1. Cliente acessa `/cliente/registro`
2. Preenche dados pessoais
3. Sistema valida e cria conta
4. Cliente faz login em `/cliente/login`
5. Recebe token JWT para autenticação

### 2. Solicitação de Vistoria
1. Cliente autenticado acessa `/cliente/nova-solicitacao`
2. Preenche dados do imóvel e preferências
3. Sistema cria solicitação com status "pendente"
4. Administrador recebe notificação

### 3. Processamento Administrativo
1. Admin acessa `/solicitacoes` no portal
2. Analisa a solicitação
3. Aprova e atribui vistoriador
4. Agenda data da vistoria
5. Status muda para "aprovada" → "agendada"

### 4. Execução da Vistoria
1. Vistoriador recebe notificação no app mobile
2. Realiza vistoria no local
3. Coleta fotos e dados
4. Gera laudo preliminar
5. Status muda para "em andamento" → "concluída"

### 5. Entrega do Laudo
1. Admin revisa laudo no portal
2. Aprova e disponibiliza para cliente
3. Cliente recebe notificação
4. Acessa `/cliente/solicitacao/[id]` para download
5. Status final: "laudo disponível"

---

## 🛠️ Comandos Úteis

### Desenvolvimento
```bash
# Instalar todas as dependências
npm run install:all

# Executar todos os serviços
npm run dev:all

# Build de produção
npm run build:all
```

### Banco de Dados
```bash
# Executar migrações
npx supabase db push

# Reset do banco (desenvolvimento)
npx supabase db reset

# Backup do banco
npx supabase db dump > backup.sql
```

### Deploy
```bash
# Deploy da API (Render)
git push origin main

# Deploy do Portal (Vercel)
npx vercel --prod

# Build do App Mobile
npx eas build --platform all
```

---

## 📞 Suporte e Manutenção

### Logs e Monitoramento
- **API**: Logs estruturados com Winston
- **Portal**: Console do navegador + Vercel Analytics
- **Banco**: Supabase Dashboard

### Backup e Recuperação
- **Banco**: Backup automático diário no Supabase
- **Arquivos**: Storage replicado no Supabase
- **Código**: Versionamento no Git

### Contatos
- **Desenvolvedor**: [Seu contato]
- **Suporte Técnico**: [Email de suporte]
- **Documentação**: Este arquivo

---

*Documento atualizado em: Janeiro 2025*
*Versão do Sistema: 1.0.0*