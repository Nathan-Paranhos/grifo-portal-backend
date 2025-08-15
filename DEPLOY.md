# 🚀 Guia de Deploy - Sistema Grifo Vistorias

Este guia contém todas as instruções necessárias para colocar o sistema Grifo Vistorias em produção.

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com)
- Conta no [Firebase](https://firebase.google.com)
- Conta no [Vercel](https://vercel.com) (para Portal Web)
- Conta no [Render](https://render.com) (para API)
- Conta no [Expo](https://expo.dev) (para App Mobile)

## 🗄️ 1. Configuração do Banco de Dados (Supabase)

### 1.1 Criar Projeto no Supabase
1. Acesse [Supabase](https://supabase.com) e crie um novo projeto
2. Anote a **URL** e **ANON_KEY** do projeto
3. Vá em Settings > API para obter as chaves

### 1.2 Executar Migrações
1. Execute os scripts SQL da pasta `database/migrations/` na ordem:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_functions.sql`
   - `004_triggers.sql`

### 1.3 Configurar RLS (Row Level Security)
1. Certifique-se de que todas as tabelas têm RLS habilitado
2. Verifique as políticas de acesso por `company_id`
3. Configure permissões para roles `anon` e `authenticated`

## 🔥 2. Configuração do Firebase

### 2.1 Criar Projeto Firebase
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Crie um novo projeto
3. Habilite Authentication
4. Configure provedores de login (Email/Password, Google, etc.)

### 2.2 Obter Configurações
1. Vá em Project Settings > General
2. Na seção "Your apps", adicione uma Web App
3. Copie as configurações do Firebase Config

## 🖥️ 3. Deploy da API (Render)

### 3.1 Preparar Repositório
1. Faça push do código da pasta `api/` para um repositório Git
2. Certifique-se de que o `Dockerfile` está na raiz

### 3.2 Configurar no Render
1. Acesse [Render](https://render.com) e crie um novo Web Service
2. Conecte seu repositório Git
3. Configure as seguintes variáveis de ambiente:

```env
NODE_ENV=production
PORT=10000
SUPABASE_URL=sua_url_supabase
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
FIREBASE_PROJECT_ID=seu_firebase_project_id
FIREBASE_PRIVATE_KEY=sua_firebase_private_key
FIREBASE_CLIENT_EMAIL=seu_firebase_client_email
JWT_SECRET=seu_jwt_secret_super_seguro
CORS_ORIGIN=https://seu-portal.vercel.app
```

### 3.3 Deploy
1. Configure Build Command: `npm install`
2. Configure Start Command: `npm start`
3. Faça o deploy
4. Teste a API em: `https://sua-api.onrender.com/health`

## 🌐 4. Deploy do Portal Web (Vercel)

### 4.1 Preparar Repositório
1. Faça push do código da pasta `portal-web/` para um repositório Git
2. Certifique-se de que o `vercel.json` está configurado

### 4.2 Configurar no Vercel
1. Acesse [Vercel](https://vercel.com) e importe o projeto
2. Configure as seguintes variáveis de ambiente:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
NEXT_PUBLIC_API_URL=https://sua-api.onrender.com
NEXT_PUBLIC_FIREBASE_API_KEY=sua_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_firebase_app_id
NEXTAUTH_URL=https://seu-portal.vercel.app
NEXTAUTH_SECRET=seu_nextauth_secret
```

### 4.3 Deploy
1. O Vercel fará o deploy automaticamente
2. Teste o portal em: `https://seu-portal.vercel.app`

## 📱 5. Deploy do App Mobile (Expo)

### 5.1 Configurar EAS CLI
```bash
npm install -g @expo/cli eas-cli
eas login
```

### 5.2 Configurar Projeto
1. Na pasta `app/`, execute:
```bash
eas init
```
2. Configure o `app.json` com suas informações
3. Configure o `eas.json` para builds de produção

### 5.3 Configurar Variáveis de Ambiente
1. Crie arquivo `.env` baseado no `.env.example`:

```env
EXPO_PUBLIC_SUPABASE_URL=sua_url_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
EXPO_PUBLIC_API_URL=https://sua-api.onrender.com
EXPO_PUBLIC_FIREBASE_API_KEY=sua_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_firebase_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=seu_firebase_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_firebase_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_firebase_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=seu_firebase_app_id
```

### 5.4 Build e Deploy
```bash
# Build para Android
eas build --platform android --profile production

# Build para iOS
eas build --platform ios --profile production

# Submit para stores
eas submit --platform android
eas submit --platform ios
```

## 🔧 6. Configurações Finais

### 6.1 Configurar CORS na API
Certifique-se de que a API aceita requisições do domínio do portal:
```javascript
const corsOptions = {
  origin: ['https://seu-portal.vercel.app'],
  credentials: true
};
```

### 6.2 Configurar Webhooks (Opcional)
Para sincronização em tempo real, configure webhooks do Supabase para a API.

### 6.3 Monitoramento
1. Configure logs no Render para a API
2. Configure Analytics no Vercel para o Portal
3. Configure Crashlytics no Expo para o App

## 🧪 7. Testes de Produção

### 7.1 Checklist de Testes
- [ ] API responde em `/health`
- [ ] Portal carrega corretamente
- [ ] Login funciona no Portal
- [ ] App mobile conecta com a API
- [ ] Login funciona no App
- [ ] Isolamento multiempresa funciona
- [ ] Upload de arquivos funciona
- [ ] Notificações funcionam

### 7.2 Testes de Carga
```bash
# Teste básico com curl
curl -X GET https://sua-api.onrender.com/health

# Teste de autenticação
curl -X POST https://sua-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## 🚨 8. Troubleshooting

### 8.1 Problemas Comuns

**API não responde:**
- Verifique variáveis de ambiente no Render
- Verifique logs de erro
- Teste conexão com Supabase

**Portal não carrega:**
- Verifique build no Vercel
- Verifique variáveis de ambiente
- Teste conexão com API

**App não conecta:**
- Verifique configurações no `app.json`
- Verifique variáveis de ambiente
- Teste em dispositivo real

### 8.2 Logs e Monitoramento
- **API**: Logs disponíveis no dashboard do Render
- **Portal**: Logs disponíveis no dashboard do Vercel
- **App**: Logs disponíveis no Expo Dashboard

## 📞 9. Suporte

Para suporte técnico:
1. Verifique os logs de cada serviço
2. Consulte a documentação das APIs
3. Verifique as configurações de ambiente

---

✅ **Sistema pronto para produção!**

Após seguir todos os passos, você terá:
- ✅ API rodando no Render
- ✅ Portal Web no Vercel
- ✅ App Mobile no Expo
- ✅ Banco de dados no Supabase
- ✅ Autenticação no Firebase
- ✅ Isolamento multiempresa funcionando
- ✅ Sistema completo e funcional