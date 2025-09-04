# 📱 Grifo App - Sistema de Vistorias Imobiliárias

> **Sistema completo de gestão de vistorias imobiliárias com autenticação segura, upload de fotos e integração com Supabase.**

## 🚀 Visão Geral

O Grifo App é uma aplicação mobile desenvolvida em React Native com Expo, projetada para facilitar o processo de vistorias imobiliárias. O sistema oferece uma interface moderna e profissional inspirada no portal Grifo, com tema escuro e design limpo.

### ✨ Principais Funcionalidades

- 🔐 **Autenticação Segura** - Login/registro com Supabase Auth
- 📋 **Gestão de Vistorias** - Criação, edição e listagem de vistorias
- 📸 **Upload de Fotos** - Captura e armazenamento de imagens
- 🏢 **Gestão de Imóveis** - Cadastro e controle de propriedades
- 🔔 **Sistema de Notificações** - Alertas e atualizações em tempo real
- 📊 **Relatórios** - Geração de relatórios detalhados
- 👥 **Multi-usuário** - Suporte a diferentes perfis e empresas

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React Native + Expo
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS (NativeWind)
- **Navegação:** Expo Router
- **Estado:** Zustand
- **Testes:** Jest + React Native Testing Library

## 📋 Pré-requisitos

- Node.js 20.x ou superior
- npm ou pnpm
- Expo CLI
- Conta no Supabase

## ⚡ Instalação e Configuração

### 1. Clone o Repositório
```bash
git clone <url-do-repositorio>
cd app-visio
```

### 2. Instale as Dependências
```bash
npm install
# ou
pnpm install
```

### 3. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
EXPO_PUBLIC_SUPABASE_URL=https://fsvwifbvehdhlufauahj.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

### 4. Execute o Projeto
```bash
npm run dev
# ou
pnpm dev
```

## 🗄️ Estrutura do Banco de Dados

### Principais Tabelas

#### `users`
- Gerenciamento de usuários do sistema
- Integração com Supabase Auth
- Suporte a diferentes tipos de usuário

#### `empresas`
- Cadastro de empresas
- Relacionamento com usuários

#### `imoveis`
- Cadastro de imóveis
- Informações detalhadas de propriedades

#### `vistorias`
- Registro de vistorias realizadas
- Status e observações

#### `fotos`
- Armazenamento de metadados de fotos
- Integração com Supabase Storage

#### `notifications`
- Sistema de notificações
- Alertas para usuários

### Segurança (RLS)

Todas as tabelas possuem Row Level Security (RLS) habilitado com políticas específicas para:
- Usuários visualizarem apenas seus próprios dados
- Empresas acessarem apenas dados relacionados
- Administradores terem acesso ampliado quando necessário

## 🔐 Sistema de Autenticação

### Fluxo de Login
1. Usuário insere email e senha
2. Validação via Supabase Auth
3. Criação automática de perfil na tabela `users`
4. Redirecionamento para dashboard

### Usuários de Teste
- **Email:** paranhoscontato.n@gmail.com
- **Email:** teste@grifo.com
- **Email:** paranhhoscontato.n@gmail.com

### Registro de Novos Usuários
- Validação de email
- Criação automática via trigger no Supabase
- Associação com empresa (quando aplicável)

## 📱 Estrutura do Projeto

```
app-visio/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   ├── pages/         # Páginas da aplicação
│   ├── hooks/         # Hooks customizados
│   └── utils/         # Utilitários
├── api/               # Lógica de backend (se aplicável)
├── services/          # Serviços (API, PDF, etc.)
├── supabase/          # Configurações e migrações
├── __tests__/         # Testes automatizados
└── assets/           # Recursos estáticos
```

## 🧪 Testes

### Executar Testes
```bash
npm test
# ou
pnpm test
```

### Cobertura de Testes
```bash
npm run test:coverage
# ou
pnpm test:coverage
```

### Status dos Testes (Última Validação)
- ✅ **Taxa de Sucesso:** 70% (7 de 10 testes)
- ✅ **Login e Autenticação:** Funcionando
- ✅ **Gestão de Vistorias:** Operacional
- ✅ **Upload de Fotos:** Integrado
- ✅ **Sistema de Notificações:** Ativo
- ❌ **Relatórios:** Dependente de API externa
- ❌ **Sincronização:** Requer serviços externos

## 🎨 Design System

### Tema
- **Estilo:** Moderno e profissional
- **Cores:** Tema escuro com acentos sóbrios
- **Inspiração:** Portal Grifo
- **Princípios:** Sem brilhos excessivos, foco na usabilidade

### Componentes Principais
- `ModernInput` - Campos de entrada estilizados
- `ModernButton` - Botões com variações
- `ModernModal` - Modais responsivos
- `ModernToast` - Notificações toast
- `OptimizedImage` - Imagens otimizadas
- `PhotoGrid` - Grade de fotos

## 🚀 Deploy

### Desenvolvimento
```bash
npm run dev
```

### Build para Produção
```bash
npm run build:web
```

### Lint e Verificações
```bash
npm run lint
```

## 📊 Status do Sistema

### ✅ Funcionalidades Implementadas
- Sistema de autenticação completo
- Interface moderna e responsiva
- Integração com Supabase
- Upload e gestão de fotos
- Sistema de notificações
- Gestão de vistorias e imóveis
- Testes automatizados

### 🔄 Em Desenvolvimento
- Integração com API Grifo externa
- Sistema de relatórios avançados
- Sincronização de dados offline

### 🎯 Próximos Passos
1. Implementar geração de relatórios local
2. Criar sistema de sincronização interno
3. Melhorar validação de emails
4. Adicionar testes automatizados para CI/CD
5. Implementar monitoramento de performance

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte técnico ou dúvidas:
- **Email:** suporte@grifoapp.com
- **Documentação:** Este README
- **Issues:** Use o sistema de issues do repositório

---

**Desenvolvido com ❤️ pela equipe SOLO Coding**

*Última atualização: Janeiro 2025*