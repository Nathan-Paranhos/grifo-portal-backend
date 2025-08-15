# 🚀 Grifo Vistorias - QA Test Suite

Suite completa de testes de qualidade para o sistema Grifo Vistorias, incluindo testes de conectividade, autenticação, segurança, banco de dados e performance.

## 📋 Visão Geral

Esta suite de testes foi desenvolvida para garantir que o sistema Grifo Vistorias esteja pronto para produção, validando:

- ✅ **Conectividade**: API, Supabase e Portal Web
- 🔐 **Autenticação**: JWT, sessões e força bruta
- 🛡️ **Segurança**: RLS, injeções, XSS, headers
- 🗄️ **Banco de Dados**: Schema, triggers, integridade
- ⚡ **Performance**: Tempo de resposta e carga
- 🔒 **Criptografia**: HTTPS, senhas, tokens

## 🛠️ Configuração

### Pré-requisitos

- Node.js >= 16.0.0
- Acesso ao Supabase do projeto
- API Grifo rodando (https://grifo-api.onrender.com)
- Portal Web rodando (https://grifo-portal.vercel.app)

### Instalação

```bash
# Navegar para a pasta de testes
cd qa-tests

# Instalar dependências
npm run setup
```

### Variáveis de Ambiente

Crie um arquivo `.env` na pasta `qa-tests` com:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

## 🚀 Execução dos Testes

### Executar Todos os Testes (Recomendado)

```bash
npm test
```

Este comando executa:
1. Testes abrangentes (conectividade, auth, performance)
2. Testes de banco de dados (schema, RLS, triggers)
3. Testes de segurança (vulnerabilidades, headers)
4. Gera relatório consolidado HTML + JSON

### Executar Testes Individuais

```bash
# Apenas testes abrangentes
npm run test:comprehensive

# Apenas testes de banco
npm run test:database

# Apenas testes de segurança
npm run test:security
```

## 📊 Relatórios

Após a execução, são gerados:

### Relatórios JSON
- `qa-test-report.json` - Testes abrangentes
- `database-qa-report.json` - Testes de banco
- `security-qa-report.json` - Testes de segurança
- `master-qa-report-[timestamp].json` - Relatório consolidado

### Relatório HTML
- `qa-report-[timestamp].html` - Relatório visual completo

## 🎯 Critérios de Aprovação

### ✅ Sistema APROVADO para Produção
- ✅ 0 problemas críticos
- ✅ 0 falhas de segurança
- ✅ RLS funcionando corretamente
- ✅ Autenticação segura
- ✅ Performance adequada

### ❌ Sistema NÃO APROVADO
- ❌ Problemas críticos de segurança
- ❌ Vazamento de dados entre empresas
- ❌ Vulnerabilidades de injeção
- ❌ Falhas na autenticação
- ❌ Performance inadequada

## 🔍 Tipos de Teste

### 1. Testes Abrangentes (`comprehensive-qa-suite.js`)

#### Conectividade
- Health check da API
- Conexão com Supabase
- Acessibilidade do Portal Web

#### Autenticação
- Registro de usuário
- Login e logout
- Validação de token JWT

#### Performance
- Tempo de resposta da API
- Teste de carga (requisições concorrentes)

#### Segurança Básica
- Proteção contra acesso não autorizado
- Validação de headers de segurança
- Teste básico de injeção SQL

### 2. Testes de Banco (`database-qa-tests.js`)

#### Schema
- Verificação de tabelas obrigatórias
- Validação de colunas essenciais

#### RLS (Row Level Security)
- Verificação se RLS está habilitado
- Teste de isolamento por company_id
- Prevenção de vazamento de dados

#### Triggers e Funções
- Triggers de updated_at
- Funções personalizadas

#### Integridade
- Constraints NOT NULL
- Constraints UNIQUE
- Validação de dados

#### Performance
- Consultas simples
- Consultas com JOIN

### 3. Testes de Segurança (`security-qa-tests.js`)

#### Autenticação Avançada
- Proteção contra força bruta
- Validação rigorosa de JWT
- Expiração de sessões

#### Autorização
- Prevenção de escalação de privilégios
- Isolamento entre empresas

#### Vulnerabilidades
- Injeção SQL avançada
- Injeção NoSQL
- Cross-Site Scripting (XSS)

#### Headers de Segurança
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- Strict-Transport-Security
- Content-Security-Policy

#### Criptografia
- Enforcement de HTTPS
- Validação de senhas fracas

#### Rate Limiting
- Proteção contra spam
- Limitação de requisições

## 🚨 Interpretação dos Resultados

### Status dos Testes
- **PASS** ✅ - Teste aprovado
- **FAIL** ❌ - Teste falhou (requer correção)
- **WARN** ⚠️ - Aviso (recomenda-se revisar)
- **CRITICAL** 🚨 - Problema crítico (BLOQUEADOR)

### Severidade
- **CRITICAL** - Bloqueia deploy em produção
- **HIGH** - Deve ser corrigido antes do deploy
- **MEDIUM** - Recomenda-se corrigir
- **LOW** - Melhoria futura

## 🔧 Troubleshooting

### Erro: "Supabase connection failed"
- Verificar variáveis de ambiente
- Confirmar se o projeto Supabase está ativo
- Validar as chaves de API

### Erro: "API not responding"
- Verificar se a API está rodando
- Confirmar URL da API
- Verificar conectividade de rede

### Erro: "Portal web not accessible"
- Verificar se o portal está rodando na porta 3000
- Confirmar se não há conflitos de porta

### Muitos testes falhando
- Verificar se todos os serviços estão rodando
- Confirmar configurações de ambiente
- Verificar logs dos serviços

## 📈 Métricas de Qualidade

### Metas de Performance
- Tempo de resposta API: < 2 segundos
- Consultas de banco: < 500ms
- Consultas com JOIN: < 1 segundo

### Metas de Segurança
- 0 vulnerabilidades críticas
- 100% dos headers de segurança
- RLS ativo em todas as tabelas críticas

### Metas de Confiabilidade
- Taxa de sucesso: > 95%
- 0 vazamentos de dados
- Autenticação 100% funcional

## 🤝 Contribuição

Para adicionar novos testes:

1. Criar função de teste na suite apropriada
2. Usar `addTestResult()` para registrar resultados
3. Documentar o teste neste README
4. Testar localmente antes do commit

## 📞 Suporte

Em caso de dúvidas ou problemas:

1. Verificar este README
2. Consultar logs dos testes
3. Verificar configurações de ambiente
4. Contatar a equipe de desenvolvimento

---

**🎯 Objetivo**: Garantir que o sistema Grifo Vistorias seja seguro, confiável e performático em produção.

**📅 Última atualização**: $(date)

**🔄 Versão**: 1.0.0