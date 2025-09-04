# 🚀 Grifo API Backend

API REST para o Sistema Grifo - Plataforma de gestão empresarial completa.

## 📋 Pré-requisitos

- Node.js 18+ 
- npm ou pnpm
- Conta no Supabase
- Banco de dados PostgreSQL (via Supabase)

## 🛠️ Instalação

1. **Clone o repositório:**
```bash
git clone https://github.com/Nathan-Paranhos/grifo-api-backend.git
cd grifo-api-backend
```

2. **Instale as dependências:**
```bash
npm install
# ou
pnpm install
```

3. **Configure as variáveis de ambiente:**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
- Configure as credenciais do Supabase
- Defina o JWT_SECRET
- Configure CORS_ORIGIN para seu domínio
- Ajuste outras variáveis conforme necessário

4. **Execute as migrações do banco:**
```bash
npm run migrate
```

## 🚀 Execução

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

### Com Docker
```bash
docker build -t grifo-api .
docker run -p 3000:3000 --env-file .env grifo-api
```

## 📚 Documentação da API

### Endpoints Principais

#### Autenticação
- `POST /api/v1/auth/login` - Login de usuário
- `POST /api/v1/auth/register` - Registro de usuário
- `POST /api/v1/auth/refresh` - Renovar token
- `POST /api/v1/auth/logout` - Logout

#### Usuários
- `GET /api/v1/tenants/{tenant}/users` - Listar usuários
- `GET /api/v1/tenants/{tenant}/users/{id}` - Obter usuário
- `POST /api/v1/tenants/{tenant}/users` - Criar usuário
- `PUT /api/v1/tenants/{tenant}/users/{id}` - Atualizar usuário
- `DELETE /api/v1/tenants/{tenant}/users/{id}` - Deletar usuário

#### Empresas
- `GET /api/v1/tenants/{tenant}/companies` - Listar empresas
- `GET /api/v1/tenants/{tenant}/companies/{id}` - Obter empresa
- `POST /api/v1/tenants/{tenant}/companies` - Criar empresa
- `PUT /api/v1/tenants/{tenant}/companies/{id}` - Atualizar empresa
- `DELETE /api/v1/tenants/{tenant}/companies/{id}` - Deletar empresa

#### Relatórios
- `GET /api/v1/tenants/{tenant}/reports` - Listar relatórios
- `GET /api/v1/tenants/{tenant}/reports/{id}` - Obter relatório
- `POST /api/v1/tenants/{tenant}/reports/generate` - Gerar relatório

## 🔧 Scripts Disponíveis

- `npm start` - Inicia o servidor em produção
- `npm run dev` - Inicia o servidor em desenvolvimento
- `npm run lint` - Executa o linter
- `npm run format` - Formata o código
- `npm run test` - Executa os testes
- `npm run migrate` - Executa migrações do banco
- `npm run docker:build` - Constrói a imagem Docker
- `npm run docker:run` - Executa o container
- `npm run logs` - Visualiza logs
- `npm run health` - Verifica saúde da API
- `npm run backup` - Faz backup do banco
- `npm run metrics` - Exibe métricas

## 🏗️ Estrutura do Projeto

```
src/
├── config/          # Configurações
├── middleware/       # Middlewares
├── routes/          # Rotas da API
├── utils/           # Utilitários
└── server.cjs       # Servidor principal
supabase/
└── migrations/      # Migrações do banco
```

## 🔒 Segurança

- Autenticação JWT
- Rate limiting configurável
- CORS configurado
- Validação de entrada
- Logs de segurança
- Criptografia de senhas com bcrypt

## 🌍 Variáveis de Ambiente

Veja o arquivo `.env.example` para todas as variáveis disponíveis.

### Principais:
- `NODE_ENV` - Ambiente (development/production)
- `PORT` - Porta do servidor
- `SUPABASE_URL` - URL do Supabase
- `SUPABASE_ANON_KEY` - Chave anônima do Supabase
- `JWT_SECRET` - Segredo para JWT
- `CORS_ORIGIN` - Origem permitida para CORS

## 📊 Monitoramento

- Logs estruturados
- Métricas de performance
- Health checks
- Rate limiting

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT.

## 🆘 Suporte

Para suporte, entre em contato através dos issues do GitHub.

---

**Sistema Grifo** - Desenvolvido com ❤️ para gestão empresarial eficiente.