# 🏢 Grifo Vistorias - Sistema Multi-tenant de Vistorias Imobiliárias

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.x-black.svg)](https://nextjs.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-blue.svg)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green.svg)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

## 📋 Visão Geral

O **Grifo Vistorias** é um ecossistema completo para gestão de vistorias imobiliárias com arquitetura multi-tenant, permitindo que múltiplas empresas utilizem o sistema de forma isolada e segura.

### 🎯 Principais Características

- **Multi-tenant**: Isolamento completo de dados por empresa
- **Tempo Real**: Sincronização automática entre portal e aplicativo
- **Offline First**: App mobile funciona sem conexão
- **Segurança**: Row-Level Security (RLS) no banco de dados
- **Escalável**: Arquitetura preparada para crescimento

## 🏗️ Arquitetura do Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Portal Web    │    │   App Mobile    │    │   Dashboard     │
│   (Next.js)     │    │ (React Native)  │    │   Analytics     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │      API Gateway          │
                    │   (Node.js + Express)     │
                    │  https://grifo-api.       │
                    │    onrender.com           │
                    └─────────────┬─────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │     Supabase Backend      │
                    │  ┌─────────────────────┐  │
                    │  │    PostgreSQL      │  │
                    │  │   + Row Level      │  │
                    │  │    Security        │  │
                    │  └─────────────────────┘  │
                    │  ┌─────────────────────┐  │
                    │  │   Authentication   │  │
                    │  │      + JWT         │  │
                    │  └─────────────────────┘  │
                    │  ┌─────────────────────┐  │
                    │  │   File Storage     │  │
                    │  │   (Fotos/PDFs)     │  │
                    │  └─────────────────────┘  │
                    └───────────────────────────┘
```

## 📁 Estrutura do Projeto

```
end-visionaria-grifo/
├── 📁 api/                     # API Node.js + Express (Produção: Render)
│   ├── src/
│   │   ├── controllers/        # Controladores das rotas
│   │   ├── middleware/         # Auth, CORS, validação
│   │   ├── routes/             # Definição das rotas
│   │   ├── services/           # Lógica de negócio
│   │   ├── utils/              # Utilitários
│   │   └── server.js           # Servidor principal
│   ├── package.json
│   └── .env.example
│
├── 📁 portal-web/              # Portal Web Next.js (Deploy: Vercel/Netlify)
│   ├── app/
│   │   ├── (auth)/             # Páginas de autenticação
│   │   ├── (protected)/        # Páginas protegidas
│   │   │   ├── dashboard/      # Dashboard principal
│   │   │   ├── empresas/       # Gestão de empresas
│   │   │   ├── imoveis/        # Gestão de imóveis
│   │   │   ├── usuarios/       # Gestão de usuários
│   │   │   ├── vistorias/      # Gestão de vistorias
│   │   │   └── usage/          # Relatórios de uso
│   │   ├── components/         # Componentes reutilizáveis
│   │   ├── lib/                # Configurações e utilitários
│   │   └── globals.css         # Estilos globais
│   ├── public/                 # Assets estáticos
│   ├── package.json
│   └── .env.local.example
│
├── 📁 app-mobile/              # App Mobile React Native + Expo
│   ├── app/
│   │   ├── (auth)/             # Telas de autenticação
│   │   ├── (tabs)/             # Navegação principal
│   │   │   ├── dashboard.tsx   # Dashboard mobile
│   │   │   ├── vistorias.tsx   # Lista de vistorias
│   │   │   ├── camera.tsx      # Captura de fotos
│   │   │   └── profile.tsx     # Perfil do usuário
│   │   └── _layout.tsx         # Layout principal
│   ├── components/             # Componentes mobile
│   ├── services/               # Serviços de API
│   ├── utils/                  # Utilitários mobile
│   ├── app.json                # Configuração Expo
│   ├── package.json
│   └── .env.example
│
├── 📁 supabase/                # Configurações do banco
│   ├── migrations/             # Migrações SQL
│   └── config.toml             # Configuração Supabase
│
├── 📁 shared/                  # Tipos e utilitários compartilhados
│   ├── types/                  # Definições TypeScript
│   └── utils/                  # Funções compartilhadas
│
├── 📄 leia.md                  # Documentação técnica detalhada
└── 📄 README.md                # Este arquivo
```

## 🛠️ Tecnologias Utilizadas

### Backend (API)
- **Node.js** 20.x - Runtime JavaScript
- **Express** 4.x - Framework web
- **Supabase JS** - Cliente do banco de dados
- **JWT** - Autenticação
- **Multer** - Upload de arquivos
- **Zod** - Validação de dados

### Frontend (Portal Web)
- **Next.js** 14.x - Framework React
- **TypeScript** 5.x - Tipagem estática
- **Tailwind CSS** - Framework CSS
- **Shadcn/ui** - Componentes UI
- **React Query** - Gerenciamento de estado servidor
- **Zustand** - Gerenciamento de estado local

### Mobile (App)
- **React Native** - Framework mobile
- **Expo** 49.x - Plataforma de desenvolvimento
- **Expo Router** - Navegação
- **Expo Camera** - Captura de fotos
- **AsyncStorage** - Armazenamento local

### Banco de Dados
- **Supabase** - Backend as a Service
- **PostgreSQL** 15.x - Banco relacional
- **Row Level Security** - Segurança multi-tenant
- **Supabase Storage** - Armazenamento de arquivos

## ⚙️ Configuração e Instalação

### Pré-requisitos

- Node.js 20.x ou superior
- npm ou pnpm
- Conta no Supabase (gratuita)
- Expo CLI (para desenvolvimento mobile)

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/end-visionaria-grifo.git
cd end-visionaria-grifo
```

### 2. Configuração do Banco (Supabase)

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute as migrações SQL em `supabase/migrations/`
3. Configure as políticas RLS
4. Crie o bucket `grifo-app` no Storage

### 3. Configuração da API

```bash
cd api
npm install
cp .env.example .env
```

Edite o arquivo `.env`:

```env
# Servidor
PORT=3001
NODE_ENV=production

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role

# JWT
JWT_SECRET=seu-jwt-secret-super-seguro

# CORS
CORS_ORIGIN=https://seu-portal.vercel.app,exp://192.168.1.100:8081
```

### 4. Configuração do Portal Web

```bash
cd portal-web
npm install
cp .env.local.example .env.local
```

Edite o arquivo `.env.local`:

```env
# App
NEXT_PUBLIC_APP_NAME="Grifo Vistorias Portal"
NEXT_PUBLIC_ENVIRONMENT=production

# API
NEXT_PUBLIC_API_BASE_URL=https://grifo-api.onrender.com/api/v1
NEXT_PUBLIC_API_TIMEOUT=30000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

### 5. Configuração do App Mobile

```bash
cd app-mobile
npm install
cp .env.example .env
```

Edite o arquivo `.env`:

```env
# API
EXPO_PUBLIC_API_BASE_URL=https://grifo-api.onrender.com/api/v1
EXPO_PUBLIC_API_TIMEOUT=30000

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

## 🚀 Executando o Projeto

### Desenvolvimento Local

```bash
# Terminal 1 - API
cd api
npm run dev

# Terminal 2 - Portal Web
cd portal-web
npm run dev

# Terminal 3 - App Mobile
cd app-mobile
npm start
```

### URLs de Desenvolvimento

- **API**: http://localhost:3001
- **Portal Web**: http://localhost:3000
- **App Mobile**: Expo DevTools

## 🌐 Deploy em Produção

### API (Render - Pago)

✅ **Status**: Já implantado em https://grifo-api.onrender.com

### Portal Web (Vercel/Netlify - Gratuito)

1. **Vercel**:
   ```bash
   cd portal-web
   npm install -g vercel
   vercel --prod
   ```

2. **Netlify**:
   ```bash
   cd portal-web
   npm run build
   # Upload da pasta .next para Netlify
   ```

### App Mobile (Expo - Gratuito)

```bash
cd app-mobile
npm install -g @expo/cli
expo build:android  # Para Android
expo build:ios      # Para iOS
```

## 🗄️ Banco de Dados

### Schema Principal

```sql
-- Empresas (Multi-tenant)
companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  settings JSONB,
  created_at TIMESTAMPTZ
)

-- Usuários
users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  role TEXT CHECK (role IN ('admin','manager','inspector','viewer')),
  company_id UUID REFERENCES companies(id),
  is_active BOOLEAN DEFAULT true
)

-- Imóveis
properties (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  address JSONB,
  owner JSONB,
  type TEXT,
  area NUMERIC,
  status TEXT
)

-- Vistorias
inspections (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),
  inspector_id UUID REFERENCES users(id),
  company_id UUID REFERENCES companies(id),
  type TEXT,
  status TEXT,
  scheduled_date TIMESTAMPTZ,
  completed_date TIMESTAMPTZ,
  report JSONB,
  photos JSONB
)
```

### Row Level Security (RLS)

Todas as tabelas possuem políticas RLS que filtram dados por `company_id`:

```sql
-- Exemplo de política RLS
CREATE POLICY "company_isolation" ON properties
FOR ALL USING (
  company_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'company_id')::uuid
);
```

### Storage Policies

```sql
-- Bucket: grifo-app
-- Estrutura: grifo-app/{company_id}/{category}/{file}
CREATE POLICY "company_files_read" ON storage.objects
FOR SELECT USING (
  bucket_id = 'grifo-app' AND
  (storage.foldername(name))[1] = auth.jwt() ->> 'company_id'
);
```

## ✅ Funcionalidades Implementadas

### 🔐 Autenticação e Autorização
- ✅ Login/logout com Supabase Auth
- ✅ Controle de acesso por roles (admin, manager, inspector, viewer)
- ✅ JWT com claims personalizados (company_id, role)
- ✅ Middleware de autenticação na API
- ✅ Proteção de rotas no portal e app

### 🏢 Gestão Multi-tenant
- ✅ Isolamento completo de dados por empresa
- ✅ Row Level Security (RLS) implementado
- ✅ Políticas de Storage por empresa
- ✅ Configurações personalizadas por empresa

### 📊 Dashboard e Relatórios
- ✅ Dashboard com métricas principais
- ✅ Gráficos de vistorias por período
- ✅ Relatórios de uso do sistema
- ✅ Estatísticas de imóveis e usuários

### 🏠 Gestão de Imóveis
- ✅ CRUD completo de imóveis
- ✅ Categorização por tipo e subtipo
- ✅ Upload de fotos e documentos
- ✅ Histórico de vistorias por imóvel

### 🔍 Gestão de Vistorias
- ✅ Criação e agendamento de vistorias
- ✅ Atribuição de vistoriadores
- ✅ Captura de fotos com comentários
- ✅ Preenchimento de checklists
- ✅ Geração de relatórios em PDF
- ✅ Sincronização offline (app mobile)

### 👥 Gestão de Usuários
- ✅ CRUD de usuários por empresa
- ✅ Controle de permissões por role
- ✅ Histórico de atividades
- ✅ Status ativo/inativo

### 📱 App Mobile
- ✅ Interface otimizada para campo
- ✅ Captura de fotos com geolocalização
- ✅ Funcionamento offline
- ✅ Sincronização automática
- ✅ Push notifications

### 🔧 Infraestrutura
- ✅ API RESTful documentada
- ✅ Validação de dados com Zod
- ✅ Upload de arquivos para Supabase Storage
- ✅ Logs estruturados
- ✅ Tratamento de erros
- ✅ CORS configurado
- ✅ Rate limiting

## 📋 Análise de Pendências

### 🔴 Crítico (Bloqueadores)

**Nenhuma pendência crítica identificada** ✅

Todos os componentes principais estão funcionais e conectados.

### 🟡 Importante (Melhorias de Produção)

1. **Monitoramento e Observabilidade**
   - [ ] Implementar logging estruturado (Winston/Pino)
   - [ ] Métricas de performance (Prometheus)
   - [ ] Health checks detalhados
   - [ ] Alertas de erro (Sentry)
   - **Impacto**: Visibilidade de problemas em produção
   - **Esforço**: 2-3 dias

2. **Testes Automatizados**
   - [ ] Testes unitários da API (Jest)
   - [ ] Testes de integração (Supertest)
   - [ ] Testes E2E do portal (Playwright)
   - [ ] Testes do app mobile (Detox)
   - **Impacto**: Qualidade e confiabilidade
   - **Esforço**: 1-2 semanas

3. **Performance e Otimização**
   - [ ] Cache Redis para consultas frequentes
   - [ ] Otimização de queries SQL
   - [ ] Compressão de imagens automática
   - [ ] CDN para assets estáticos
   - **Impacto**: Velocidade e experiência do usuário
   - **Esforço**: 1 semana

4. **Segurança Avançada**
   - [ ] Rate limiting por usuário
   - [ ] Auditoria de ações (audit log)
   - [ ] Criptografia de dados sensíveis
   - [ ] Backup automático do banco
   - **Impacto**: Segurança e compliance
   - **Esforço**: 1 semana

### 🟢 Desejável (Funcionalidades Futuras)

1. **Integrações Externas**
   - [ ] API de CEP (ViaCEP)
   - [ ] Integração com Google Maps
   - [ ] Webhook para sistemas externos
   - [ ] API de assinatura digital
   - **Impacto**: Automação e integração
   - **Esforço**: 2-3 semanas

2. **Funcionalidades Avançadas**
   - [ ] Templates de relatórios customizáveis
   - [ ] Workflow de aprovação de vistorias
   - [ ] Agendamento automático
   - [ ] Chat interno entre usuários
   - **Impacto**: Produtividade e colaboração
   - **Esforço**: 3-4 semanas

3. **Analytics e BI**
   - [ ] Dashboard executivo avançado
   - [ ] Relatórios customizáveis
   - [ ] Exportação para Excel/CSV
   - [ ] Análise de tendências
   - **Impacto**: Insights de negócio
   - **Esforço**: 2-3 semanas

4. **Mobile Avançado**
   - [ ] Modo offline completo
   - [ ] Sincronização inteligente
   - [ ] Captura de vídeos
   - [ ] Reconhecimento de voz
   - **Impacto**: Experiência mobile
   - **Esforço**: 2-3 semanas

## 🗺️ Roadmap

### Q1 2024 - Estabilização
- [ ] Implementar monitoramento completo
- [ ] Adicionar testes automatizados
- [ ] Otimizar performance
- [ ] Melhorar segurança

### Q2 2024 - Expansão
- [ ] Integrações externas
- [ ] Funcionalidades avançadas
- [ ] Mobile aprimorado
- [ ] Analytics básico

### Q3 2024 - Inteligência
- [ ] BI avançado
- [ ] Automações
- [ ] Machine Learning básico
- [ ] API pública

### Q4 2024 - Escala
- [ ] Multi-região
- [ ] Microserviços
- [ ] Kubernetes
- [ ] Marketplace de integrações

## 🤝 Contribuição

### Padrões de Código

- **TypeScript**: Tipagem obrigatória
- **ESLint**: Linting configurado
- **Prettier**: Formatação automática
- **Conventional Commits**: Padrão de commits

### Fluxo de Desenvolvimento

1. Fork do repositório
2. Criar branch feature: `git checkout -b feature/nova-funcionalidade`
3. Commit das mudanças: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Push para branch: `git push origin feature/nova-funcionalidade`
5. Abrir Pull Request

### Estrutura de Commits

```
feat: nova funcionalidade
fix: correção de bug
docs: documentação
style: formatação
refactor: refatoração
test: testes
chore: manutenção
```

## 🔧 Troubleshooting

### Problemas Comuns

**1. Erro de CORS**
```
Solução: Verificar CORS_ORIGIN na API
Arquivo: api/.env
Variável: CORS_ORIGIN=https://seu-portal.com
```

**2. Erro de Autenticação**
```
Solução: Verificar JWT_SECRET e chaves Supabase
Arquivos: api/.env, portal-web/.env.local
```

**3. Upload de Arquivos Falha**
```
Solução: Verificar políticas do Storage Supabase
Bucket: grifo-app
Políticas: RLS habilitado
```

**4. App Mobile Não Conecta**
```
Solução: Verificar URL da API no .env
Variável: EXPO_PUBLIC_API_BASE_URL
```

### Logs Úteis

```bash
# API
cd api && npm run logs

# Portal
cd portal-web && npm run build

# Mobile
cd app-mobile && expo doctor
```

## 📞 Suporte

- **Documentação**: [leia.md](./leia.md)
- **Issues**: GitHub Issues
- **Email**: suporte@grifovistorias.com

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

**Grifo Vistorias** - Sistema completo para gestão de vistorias imobiliárias 🏠✅