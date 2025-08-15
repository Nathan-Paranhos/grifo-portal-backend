# 🛠️ Scripts de Manutenção - Grifo Vistorias

Esta pasta contém scripts essenciais para backup, restore e manutenção do sistema Grifo Vistorias.

## 📋 Scripts Disponíveis

### 🗄️ backup.js
Script completo de backup do sistema, incluindo:
- Todas as tabelas do banco de dados
- Configurações do sistema
- Logs de aplicação
- Dados anonimizados para segurança

### 🔄 restore.js
Script de restauração que permite:
- Listar backups disponíveis
- Restaurar dados de backup específico
- Verificação de integridade
- Backup de segurança automático

## 🚀 Instalação

```bash
cd scripts
npm install
```

## ⚙️ Configuração

Antes de usar os scripts, configure as variáveis de ambiente:

```bash
# Obrigatório para backup/restore completo
export SUPABASE_SERVICE_KEY="sua-service-role-key"

# Opcional (usa valores padrão se não definido)
export SUPABASE_URL="https://fsvwifbvehdhlufauahj.supabase.co"
export NODE_ENV="production"
```

### 🔑 Obtendo a Service Role Key

1. Acesse o painel do Supabase
2. Vá em Settings → API
3. Copie a "service_role" key (não a anon key)
4. **⚠️ IMPORTANTE**: Esta chave tem privilégios administrativos - mantenha segura!

## 📖 Como Usar

### Criar Backup

```bash
# Backup completo
node backup.js

# Ou usando npm script
npm run backup
```

**Saída esperada:**
```
🚀 Iniciando backup do sistema Grifo Vistorias...
📅 Timestamp: 2024-01-15T10-30-45-123Z
📁 Diretório de backup: /backups/backup-2024-01-15T10-30-45-123Z
📊 Iniciando backup das tabelas...
  📋 Backup da tabela: empresas
  ✅ empresas: 5 registros
  📋 Backup da tabela: usuarios
  ✅ usuarios: 12 registros
...
✅ Backup concluído com sucesso!
📦 Arquivo: /backups/backup-2024-01-15T10-30-45-123Z.zip
📊 Total de arquivos: 15
💾 Tamanho total: 2.34 MB
```

### Listar Backups

```bash
# Listar todos os backups
node restore.js

# Ou usando npm script
npm run list-backups
```

**Saída esperada:**
```
📋 Backups disponíveis:
  1. backup-2024-01-15T10-30-45-123Z.zip (15/01/2024 10:30:45) - 2.34 MB
  2. backup-2024-01-14T09-15-30-456Z (14/01/2024 09:15:30) - N/A
  3. backup-2024-01-13T14-22-18-789Z.zip (13/01/2024 14:22:18) - 1.98 MB

💡 Use: node restore.js <nome-do-backup>
```

### Restaurar Backup

```bash
# Restaurar backup específico
node restore.js backup-2024-01-15T10-30-45-123Z.zip

# Ou diretório descompactado
node restore.js backup-2024-01-15T10-30-45-123Z
```

**Processo interativo:**
```
🔄 Iniciando restore do sistema Grifo Vistorias...
📦 Extraindo backup compactado...
  ✅ Extraído para: /backups/backup-2024-01-15T10-30-45-123Z
🔍 Validando backup...
  📋 Backup ID: backup-2024-01-15T10-30-45-123Z
  📅 Criado em: 2024-01-15T10:30:45.123Z
  📊 Arquivos: 15
  ✅ Backup válido
⚠️  ATENÇÃO: Este processo irá SOBRESCREVER os dados atuais. Continuar? (sim/não): sim
🛡️ Criando backup de segurança dos dados atuais...
📊 Restaurando tabelas...
...
✅ Restore concluído!
📊 Resumo: 7/7 tabelas OK
```

## 📁 Estrutura dos Backups

Cada backup contém:

```
backup-YYYY-MM-DDTHH-mm-ss-sssZ/
├── manifest.json          # Metadados do backup
├── config.json           # Configurações do sistema
├── empresas.json         # Dados das empresas
├── usuarios.json         # Dados dos usuários (anonimizados)
├── imoveis.json          # Dados dos imóveis
├── vistorias.json        # Dados das vistorias
├── contestacoes.json     # Dados das contestações
├── fotos.json            # Metadados das fotos
├── configuracoes.json    # Configurações do sistema
└── logs/                 # Logs da aplicação (se existirem)
    ├── app.log
    ├── error.log
    └── access.log
```

### 📋 Manifest.json
```json
{
  "backup_id": "backup-2024-01-15T10-30-45-123Z",
  "created_at": "2024-01-15T10:30:45.123Z",
  "version": "1.0.0",
  "type": "full",
  "files": [...],
  "total_files": 15,
  "total_size": 2453678
}
```

## 🔒 Segurança e Privacidade

### Dados Anonimizados
Os scripts automaticamente anonimizam dados sensíveis:

- **E-mails**: `user@example.com` → `us***@example.com`
- **CNPJs**: `12.345.678/0001-90` → `12**********90`
- **Senhas**: Completamente removidas
- **Tokens**: Completamente removidos

### Backup de Segurança
Antes de qualquer restore, o sistema:
1. Cria automaticamente um backup dos dados atuais
2. Solicita confirmação explícita do usuário
3. Valida a integridade do backup a ser restaurado

## 🚨 Troubleshooting

### Erro: "SUPABASE_SERVICE_KEY não configurada"
```bash
# Configure a variável de ambiente
export SUPABASE_SERVICE_KEY="sua-service-role-key"

# Ou crie um arquivo .env na pasta scripts
echo "SUPABASE_SERVICE_KEY=sua-service-role-key" > .env
```

### Erro: "permission denied for table"
- Verifique se está usando a SERVICE_ROLE key (não a anon key)
- Confirme se a key tem permissões administrativas

### Erro: "archiver not found" ou "adm-zip not found"
```bash
# Instalar dependências opcionais
npm install archiver adm-zip
```

### Backup muito grande
- Os backups são automaticamente compactados
- Dados sensíveis são anonimizados para reduzir tamanho
- Considere fazer backups incrementais para grandes volumes

### Restore parcial
Se algumas tabelas falharem no restore:
1. Verifique os logs de erro
2. Confirme se as tabelas existem no Supabase
3. Verifique as políticas RLS
4. Execute o restore novamente (é idempotente)

## 📊 Monitoramento

### Logs
Os scripts geram logs detalhados:
- ✅ Sucessos em verde
- ⚠️ Avisos em amarelo  
- ❌ Erros em vermelho
- 📊 Estatísticas de progresso

### Verificação de Integridade
Após cada restore:
- Conta registros em cada tabela
- Compara com dados do backup
- Reporta divergências
- Sugere ações corretivas

## 🔄 Automação

### Backup Automático (Cron)
```bash
# Adicionar ao crontab para backup diário às 2h
0 2 * * * cd /path/to/scripts && node backup.js

# Backup semanal com limpeza de backups antigos
0 2 * * 0 cd /path/to/scripts && node backup.js && find ../backups -name "*.zip" -mtime +30 -delete
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Create Backup
  run: |
    cd scripts
    npm install
    node backup.js
  env:
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
```

## 📞 Suporte

Em caso de problemas:
1. Verifique os logs detalhados
2. Confirme as variáveis de ambiente
3. Teste a conectividade com Supabase
4. Consulte a documentação do Supabase

---

**⚠️ IMPORTANTE**: Sempre teste os scripts em ambiente de desenvolvimento antes de usar em produção!