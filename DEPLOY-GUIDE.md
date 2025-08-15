# 🚀 Guia Completo de Deploy - Grifo Vistorias

## 📋 Visão Geral

Este projeto está estruturado para deploy independente de cada componente:

- **API**: Hospedada no Render (https://grifo-api.onrender.com)
- **Portal Web**: Deploy no Vercel
- **App Mobile**: Deploy no Expo/EAS
- **Database**: Supabase (já configurado)
- **QA Tests**: Executados localmente

## 🏗️ Estrutura Final

```
end-visionaria-grifo/
├── api-grifo/          # API já hospedada no Render
├── portal-web/         # Portal administrativo → Vercel
├── app-mobile/         # App React Native → Expo/EAS
├── database/           # Scripts SQL para Supabase
├── shared/             # Bibliotecas compartilhadas
├── qa-tests/           # Testes de qualidade
└── DEPLOY-GUIDE.md     # Este guia
```

## 🌐 1. Portal Web (Vercel)

### Pré-requisitos
- Conta no Vercel
- Repositório Git conectado
- Variáveis de ambiente configuradas

### Configuração

1. **Instalar Vercel CLI**:
```bash
npm i -g vercel
```

2. **Configurar variáveis de ambiente**:
```bash
# No painel do Vercel ou via CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_GRIFO_API_URL
```

3. **Deploy**:
```bash
cd portal-web
vercel --prod
```

### Arquivos de Configuração
- `vercel.json`: Configurações de build e headers de segurança
- `.env.example`: Template das variáveis de ambiente
- `package.json`: Scripts otimizados para produção

### Scripts Disponíveis
```bash
npm run build      # Build de produção
npm run start      # Servidor de produção
npm run check      # Lint + Build (validação)
npm run analyze    # Análise do bundle
```

## 📱 2. App Mobile (Expo/EAS)

### Pré-requisitos
- Conta no Expo
- EAS CLI instalado
- Certificados de desenvolvimento configurados

### Configuração

1. **Instalar EAS CLI**:
```bash
npm install -g eas-cli
```

2. **Login no Expo**:
```bash
eas login
```

3. **Configurar projeto**:
```bash
cd app-mobile
eas build:configure
```

### Deploy

**Build de Desenvolvimento**:
```bash
eas build --platform android --profile development
eas build --platform ios --profile development
```

**Build de Produção**:
```bash
eas build --platform android --profile production
eas build --platform ios --profile production
```

**Publicar Update**:
```bash
eas update --branch production
```

### Arquivos de Configuração
- `eas.json`: Configurações de build para diferentes ambientes
- `app.json`: Configurações do app Expo
- `.env.example`: Template das variáveis de ambiente

### Scripts Disponíveis
```bash
npm run start           # Expo development server
npm run build:android   # Build Android via EAS
npm run build:ios       # Build iOS via EAS
npm run preview         # Preview de produção
```

## 🗄️ 3. Database (Supabase)

### Configuração
O banco já está configurado e rodando no Supabase.

**URL**: https://fsvwifbvehdhlufauahj.supabase.co

### Scripts de Migração
```bash
# Aplicar migrações (se necessário)
cd database
supabase db push
```

### Backup
```bash
# Backup do banco
supabase db dump --file backup.sql
```

## 🔧 4. API (Render)

### Status
A API já está hospedada e funcionando no Render:
**URL**: https://grifo-api.onrender.com

### Monitoramento
- Logs disponíveis no painel do Render
- Health check: `GET /api/health`
- Documentação: `GET /api/docs`

## 🧪 5. Testes QA

### Executar Testes
```bash
cd qa-tests
npm install
npm run test
```

### Tipos de Teste
- **Comprehensive**: Testes gerais de conectividade e funcionalidade
- **Database**: Testes específicos do banco de dados
- **Security**: Testes de segurança e vulnerabilidades

### Relatórios
Os testes geram relatórios em:
- `qa-results.json`: Resultados em JSON
- `qa-report.html`: Relatório visual detalhado

## 🔐 6. Variáveis de Ambiente

### Portal Web (.env)
```env
NEXT_PUBLIC_SUPABASE_URL=https://fsvwifbvehdhlufauahj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_GRIFO_API_URL=https://grifo-api.onrender.com
NODE_ENV=production
```

### App Mobile (.env)
```env
EXPO_PUBLIC_SUPABASE_URL=https://fsvwifbvehdhlufauahj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_GRIFO_API_URL=https://grifo-api.onrender.com
NODE_ENV=production
```

## 🚀 7. Processo de Deploy Completo

### 1. Preparação
```bash
# Executar testes QA
cd qa-tests && npm run test

# Verificar builds
cd ../portal-web && npm run check
cd ../app-mobile && npm run check
```

### 2. Deploy Portal Web
```bash
cd portal-web
vercel --prod
```

### 3. Deploy App Mobile
```bash
cd app-mobile
eas build --platform all --profile production
eas submit --platform all
```

### 4. Verificação
- ✅ Portal Web: Acessar URL do Vercel
- ✅ App Mobile: Testar builds nos dispositivos
- ✅ API: Verificar health check
- ✅ Database: Executar queries de teste

## 📊 8. Monitoramento

### URLs de Produção
- **API**: https://grifo-api.onrender.com
- **Portal**: [URL do Vercel após deploy]
- **Database**: https://fsvwifbvehdhlufauahj.supabase.co

### Health Checks
```bash
# API
curl https://grifo-api.onrender.com/api/health

# Portal (após deploy)
curl https://your-app.vercel.app/api/health
```

## 🔧 9. Troubleshooting

### Problemas Comuns

**Build falha no Vercel**:
- Verificar variáveis de ambiente
- Executar `npm run check` localmente
- Verificar logs no painel do Vercel

**App não conecta com API**:
- Verificar CORS na API
- Confirmar URLs nas variáveis de ambiente
- Testar endpoints manualmente

**Erro de autenticação**:
- Verificar chaves do Supabase
- Confirmar políticas RLS
- Testar login manual

### Logs
- **Vercel**: Painel do Vercel → Functions → Logs
- **Render**: Painel do Render → Logs
- **Expo**: `eas build:list` para status dos builds

## 📝 10. Checklist de Deploy

### Pré-Deploy
- [ ] Testes QA executados com sucesso
- [ ] Builds locais funcionando
- [ ] Variáveis de ambiente configuradas
- [ ] Certificados válidos (mobile)

### Deploy
- [ ] Portal Web deployado no Vercel
- [ ] App Mobile buildado via EAS
- [ ] API funcionando no Render
- [ ] Database acessível

### Pós-Deploy
- [ ] Health checks passando
- [ ] Funcionalidades principais testadas
- [ ] Monitoramento ativo
- [ ] Documentação atualizada

## 🆘 11. Suporte

### Contatos
- **Render**: Painel de controle para logs da API
- **Vercel**: Painel de controle para logs do portal
- **Expo**: Dashboard para builds e updates
- **Supabase**: Dashboard para database e auth

### Comandos Úteis
```bash
# Verificar status dos serviços
curl -I https://grifo-api.onrender.com/api/health

# Logs do Vercel
vercel logs [deployment-url]

# Status dos builds EAS
eas build:list

# Executar testes QA
cd qa-tests && npm run test
```

---

**✅ Sistema pronto para produção!**

Todos os componentes foram otimizados, testados e estão prontos para deploy independente. Cada serviço pode ser escalado e mantido separadamente.