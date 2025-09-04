# Configuração de Produção - Sistema Grifo

## ✅ Limpeza Realizada

O sistema foi completamente limpo e está pronto para produção:

### Dados Removidos
- ✅ Todos os usuários de teste removidos
- ✅ Dados de vistorias de exemplo removidos
- ✅ Logs de desenvolvimento limpos
- ✅ Tabelas de auditoria resetadas
- ✅ Arquivos temporários removidos
- ✅ 35 migrations desnecessárias removidas (mantidas apenas 13 essenciais)

### Estrutura Mantida
- ✅ Esquema completo do banco de dados
- ✅ Tabelas principais: users, portal_users, empresas, tenants, clients, inspection_requests
- ✅ Configurações de RLS (Row Level Security)
- ✅ Permissões para usuários anon e authenticated
- ✅ Funções e triggers essenciais

## 🔐 Credenciais de Produção

### Usuário Administrador Principal
- **Email**: admin@grifo.com
- **Senha**: Admin@2024
- **Tipo**: Administrador do sistema
- **Tenant**: Grifo
- **Empresa**: Grifo Vistorias Ltda

> ⚠️ **IMPORTANTE**: Altere esta senha após o primeiro login!

### Supabase
- **Project URL**: https://wnqjqjqjqjqjqjqjqjqj.supabase.co
- **Anon Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
- **Service Role Key**: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

## 📁 Arquivos de Configuração

### API (api/.env.production)
```env
# Configurações principais
NODE_ENV=production
PORT=3001
API_VERSION=v1
APP_NAME=Grifo API
APP_URL=https://api.grifo.com

# Segurança
JWT_SECRET=your-super-secure-jwt-secret-key-here
BCRYPT_ROUNDS=12

# Supabase
SUPABASE_URL=https://wnqjqjqjqjqjqjqjqjqj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# CORS
CORS_ORIGIN=https://grifo.com,https://www.grifo.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/grifo-api.log

# Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=uploads

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@grifo.com
SMTP_PASS=your-email-password
EMAIL_FROM=noreply@grifo.com
```

### Portal Web (portal-web/.env.production)
```env
# API Grifo
NEXT_PUBLIC_API_URL=https://api.grifo.com/api
NEXT_PUBLIC_APP_URL=https://grifo.com

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://wnqjqjqjqjqjqjqjqjqj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Aplicação
NEXT_PUBLIC_APP_NAME=Grifo
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=production

# NextAuth
NEXTAUTH_URL=https://grifo.com
NEXTAUTH_SECRET=your-nextauth-secret-key-here

# Segurança e Monitoramento
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn-here
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id-here
```

## 🚀 Deploy

### Pré-requisitos
1. Node.js 20.x ou superior
2. npm ou pnpm
3. Projeto Supabase configurado
4. Domínio configurado (grifo.com)

### Passos para Deploy

1. **Clone o repositório**
```bash
git clone <repository-url>
cd end-visionaria-grifo
```

2. **Configure as variáveis de ambiente**
```bash
# API
cp api/.env.production api/.env
# Edite api/.env com suas configurações

# Portal Web
cp portal-web/.env.production portal-web/.env.local
# Edite portal-web/.env.local com suas configurações
```

3. **Instale as dependências**
```bash
# API
cd api
npm install

# Portal Web
cd ../portal-web
npm install
```

4. **Execute as migrations do Supabase**
```bash
# As migrations já foram aplicadas e limpas
# Apenas verifique se o banco está atualizado
```

5. **Build e Deploy**
```bash
# API
cd api
npm run build
npm start

# Portal Web
cd ../portal-web
npm run build
npm start
```

## 🔧 Configurações Adicionais

### Nginx (Exemplo)
```nginx
server {
    listen 80;
    server_name grifo.com www.grifo.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name grifo.com www.grifo.com;
    
    # SSL configuration
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Portal Web
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### PM2 (Process Manager)
```json
{
  "apps": [
    {
      "name": "grifo-api",
      "script": "src/server.js",
      "cwd": "./api",
      "env": {
        "NODE_ENV": "production"
      }
    },
    {
      "name": "grifo-portal",
      "script": "npm",
      "args": "start",
      "cwd": "./portal-web",
      "env": {
        "NODE_ENV": "production"
      }
    }
  ]
}
```

## 📋 Checklist Pós-Deploy

- [ ] Alterar senha do usuário admin@grifo.com
- [ ] Configurar certificado SSL
- [ ] Configurar backup automático do banco
- [ ] Configurar monitoramento (logs, métricas)
- [ ] Testar todas as funcionalidades principais
- [ ] Configurar alertas de erro
- [ ] Documentar procedimentos de manutenção

## 🆘 Suporte

Em caso de problemas:
1. Verifique os logs da aplicação
2. Confirme se todas as variáveis de ambiente estão configuradas
3. Verifique a conectividade com o Supabase
4. Consulte a documentação técnica do projeto

---

**Sistema limpo e pronto para produção!** 🎉

*Documento gerado automaticamente em: 27/08/2025*