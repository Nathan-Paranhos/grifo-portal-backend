#!/usr/bin/env node

/**
 * Script de Backup Automatizado - Grifo Vistorias
 * 
 * Este script realiza backup completo do sistema:
 * - Banco de dados Supabase
 * - Configurações de ambiente
 * - Logs de aplicação
 * - Dados de usuários (anonimizados)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fsvwifbvehdhlufauahj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Necessário para backup completo
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

// Inicializar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Criar diretório de backup
 */
function createBackupDir() {
  const backupPath = path.join(BACKUP_DIR, `backup-${TIMESTAMP}`);
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  return backupPath;
}

/**
 * Backup das tabelas principais
 */
async function backupTables(backupPath) {
  console.log('📊 Iniciando backup das tabelas...');
  
  const tables = [
    'empresas',
    'usuarios', 
    'imoveis',
    'vistorias',
    'contestacoes',
    'fotos',
    'configuracoes'
  ];

  for (const table of tables) {
    try {
      console.log(`  📋 Backup da tabela: ${table}`);
      
      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        console.error(`❌ Erro no backup da tabela ${table}:`, error);
        continue;
      }

      // Anonimizar dados sensíveis se necessário
      const sanitizedData = sanitizeData(table, data);
      
      const filePath = path.join(backupPath, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(sanitizedData, null, 2));
      
      console.log(`  ✅ ${table}: ${data?.length || 0} registros`);
    } catch (err) {
      console.error(`❌ Erro no backup da tabela ${table}:`, err);
    }
  }
}

/**
 * Sanitizar dados sensíveis
 */
function sanitizeData(table, data) {
  if (!data) return data;
  
  return data.map(record => {
    const sanitized = { ...record };
    
    // Remover/anonimizar campos sensíveis
    if (table === 'usuarios') {
      if (sanitized.email) {
        sanitized.email = sanitized.email.replace(/(.{2}).*(@.*)/, '$1***$2');
      }
      delete sanitized.password_hash;
      delete sanitized.reset_token;
    }
    
    if (table === 'empresas') {
      if (sanitized.cnpj) {
        sanitized.cnpj = sanitized.cnpj.replace(/(\d{2})\d{10}(\d{2})/, '$1**********$2');
      }
    }
    
    return sanitized;
  });
}

/**
 * Backup das configurações
 */
function backupConfigs(backupPath) {
  console.log('⚙️ Backup das configurações...');
  
  const configs = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    api_url: process.env.GRIFO_API_URL || 'https://grifo-api.onrender.com',
    supabase_url: SUPABASE_URL,
    backup_type: 'full'
  };
  
  const configPath = path.join(backupPath, 'config.json');
  fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
  
  console.log('  ✅ Configurações salvas');
}

/**
 * Backup dos logs (se existirem)
 */
function backupLogs(backupPath) {
  console.log('📝 Backup dos logs...');
  
  const logSources = [
    path.join(__dirname, '..', 'logs'),
    path.join(__dirname, '..', 'api-grifo', 'logs'),
    path.join(__dirname, '..', 'portal-web', '.next', 'logs')
  ];
  
  let logCount = 0;
  
  logSources.forEach(logDir => {
    if (fs.existsSync(logDir)) {
      const files = fs.readdirSync(logDir);
      files.forEach(file => {
        if (file.endsWith('.log')) {
          const sourcePath = path.join(logDir, file);
          const destPath = path.join(backupPath, 'logs', file);
          
          if (!fs.existsSync(path.dirname(destPath))) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
          }
          
          fs.copyFileSync(sourcePath, destPath);
          logCount++;
        }
      });
    }
  });
  
  console.log(`  ✅ ${logCount} arquivos de log copiados`);
}

/**
 * Criar arquivo de manifesto
 */
function createManifest(backupPath) {
  console.log('📋 Criando manifesto do backup...');
  
  const files = fs.readdirSync(backupPath, { recursive: true });
  const manifest = {
    backup_id: `backup-${TIMESTAMP}`,
    created_at: new Date().toISOString(),
    version: '1.0.0',
    type: 'full',
    files: files.map(file => {
      const filePath = path.join(backupPath, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
    }),
    total_files: files.length,
    total_size: files.reduce((total, file) => {
      const filePath = path.join(backupPath, file);
      return total + fs.statSync(filePath).size;
    }, 0)
  };
  
  const manifestPath = path.join(backupPath, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  console.log('  ✅ Manifesto criado');
  return manifest;
}

/**
 * Compactar backup (opcional)
 */
function compressBackup(backupPath) {
  console.log('🗜️ Compactando backup...');
  
  try {
    const archiver = require('archiver');
    const output = fs.createWriteStream(`${backupPath}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    return new Promise((resolve, reject) => {
      output.on('close', () => {
        console.log(`  ✅ Backup compactado: ${archive.pointer()} bytes`);
        resolve(`${backupPath}.zip`);
      });
      
      archive.on('error', reject);
      archive.pipe(output);
      archive.directory(backupPath, false);
      archive.finalize();
    });
  } catch (err) {
    console.warn('⚠️ Compactação não disponível (instale archiver):', err.message);
    return backupPath;
  }
}

/**
 * Executar backup completo
 */
async function runBackup() {
  console.log('🚀 Iniciando backup do sistema Grifo Vistorias...');
  console.log(`📅 Timestamp: ${TIMESTAMP}`);
  
  try {
    // Verificar se temos as credenciais necessárias
    if (!SUPABASE_SERVICE_KEY) {
      console.error('❌ SUPABASE_SERVICE_KEY não configurada');
      console.log('💡 Configure a variável de ambiente SUPABASE_SERVICE_KEY');
      process.exit(1);
    }
    
    // Criar diretório de backup
    const backupPath = createBackupDir();
    console.log(`📁 Diretório de backup: ${backupPath}`);
    
    // Executar backups
    await backupTables(backupPath);
    backupConfigs(backupPath);
    backupLogs(backupPath);
    
    // Criar manifesto
    const manifest = createManifest(backupPath);
    
    // Compactar (opcional)
    const finalPath = await compressBackup(backupPath);
    
    console.log('\n✅ Backup concluído com sucesso!');
    console.log(`📦 Arquivo: ${finalPath}`);
    console.log(`📊 Total de arquivos: ${manifest.total_files}`);
    console.log(`💾 Tamanho total: ${(manifest.total_size / 1024 / 1024).toFixed(2)} MB`);
    
    return finalPath;
    
  } catch (error) {
    console.error('❌ Erro durante o backup:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runBackup();
}

module.exports = { runBackup };