#!/usr/bin/env node

/**
 * Script de Restore Automatizado - Grifo Vistorias
 * 
 * Este script restaura backup completo do sistema:
 * - Banco de dados Supabase
 * - Configurações de ambiente
 * - Validação de integridade
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configurações
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fsvwifbvehdhlufauahj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Necessário para restore completo
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Inicializar cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Listar backups disponíveis
 */
function listBackups() {
  console.log('📋 Backups disponíveis:');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    console.log('  ❌ Nenhum backup encontrado');
    return [];
  }
  
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(item => {
      const itemPath = path.join(BACKUP_DIR, item);
      return fs.statSync(itemPath).isDirectory() || item.endsWith('.zip');
    })
    .map(item => {
      const itemPath = path.join(BACKUP_DIR, item);
      const stats = fs.statSync(itemPath);
      return {
        name: item,
        path: itemPath,
        created: stats.mtime,
        size: stats.size,
        type: item.endsWith('.zip') ? 'compressed' : 'directory'
      };
    })
    .sort((a, b) => b.created - a.created);
  
  backups.forEach((backup, index) => {
    const size = backup.type === 'compressed' 
      ? `${(backup.size / 1024 / 1024).toFixed(2)} MB`
      : 'N/A';
    console.log(`  ${index + 1}. ${backup.name} (${backup.created.toLocaleString()}) - ${size}`);
  });
  
  return backups;
}

/**
 * Extrair backup compactado
 */
async function extractBackup(backupPath) {
  if (!backupPath.endsWith('.zip')) {
    return backupPath;
  }
  
  console.log('📦 Extraindo backup compactado...');
  
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(backupPath);
    const extractPath = backupPath.replace('.zip', '');
    
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true });
    }
    
    zip.extractAllTo(extractPath, true);
    console.log(`  ✅ Extraído para: ${extractPath}`);
    
    return extractPath;
  } catch (err) {
    console.error('❌ Erro ao extrair backup:', err.message);
    console.log('💡 Instale adm-zip: npm install adm-zip');
    throw err;
  }
}

/**
 * Validar backup
 */
function validateBackup(backupPath) {
  console.log('🔍 Validando backup...');
  
  // Verificar se o manifesto existe
  const manifestPath = path.join(backupPath, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('Manifesto do backup não encontrado');
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`  📋 Backup ID: ${manifest.backup_id}`);
  console.log(`  📅 Criado em: ${manifest.created_at}`);
  console.log(`  📊 Arquivos: ${manifest.total_files}`);
  
  // Verificar arquivos essenciais
  const requiredFiles = ['config.json'];
  const missingFiles = requiredFiles.filter(file => 
    !fs.existsSync(path.join(backupPath, file))
  );
  
  if (missingFiles.length > 0) {
    throw new Error(`Arquivos essenciais não encontrados: ${missingFiles.join(', ')}`);
  }
  
  console.log('  ✅ Backup válido');
  return manifest;
}

/**
 * Confirmar restore
 */
function confirmRestore() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('⚠️  ATENÇÃO: Este processo irá SOBRESCREVER os dados atuais. Continuar? (sim/não): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'sim' || answer.toLowerCase() === 's');
    });
  });
}

/**
 * Backup dos dados atuais (segurança)
 */
async function createSafetyBackup() {
  console.log('🛡️ Criando backup de segurança dos dados atuais...');
  
  const { runBackup } = require('./backup.js');
  const safetyBackupPath = await runBackup();
  
  console.log(`  ✅ Backup de segurança criado: ${safetyBackupPath}`);
  return safetyBackupPath;
}

/**
 * Restaurar tabelas
 */
async function restoreTables(backupPath) {
  console.log('📊 Restaurando tabelas...');
  
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
    const filePath = path.join(backupPath, `${table}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️ Arquivo não encontrado: ${table}.json`);
      continue;
    }
    
    try {
      console.log(`  📋 Restaurando tabela: ${table}`);
      
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      if (!data || data.length === 0) {
        console.log(`  ⚠️ Tabela ${table} vazia`);
        continue;
      }
      
      // Limpar tabela atual (CUIDADO!)
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      
      if (deleteError) {
        console.error(`  ❌ Erro ao limpar tabela ${table}:`, deleteError);
        continue;
      }
      
      // Inserir dados do backup
      const { error: insertError } = await supabase
        .from(table)
        .insert(data);
      
      if (insertError) {
        console.error(`  ❌ Erro ao restaurar tabela ${table}:`, insertError);
        continue;
      }
      
      console.log(`  ✅ ${table}: ${data.length} registros restaurados`);
      
    } catch (err) {
      console.error(`  ❌ Erro ao processar tabela ${table}:`, err.message);
    }
  }
}

/**
 * Verificar integridade pós-restore
 */
async function verifyRestore(backupPath) {
  console.log('🔍 Verificando integridade do restore...');
  
  const tables = ['empresas', 'usuarios', 'imoveis', 'vistorias'];
  const results = {};
  
  for (const table of tables) {
    try {
      // Contar registros na tabela
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        results[table] = { status: 'error', error: error.message };
        continue;
      }
      
      // Comparar com backup
      const filePath = path.join(backupPath, `${table}.json`);
      if (fs.existsSync(filePath)) {
        const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const backupCount = backupData.length;
        
        results[table] = {
          status: count === backupCount ? 'ok' : 'warning',
          current: count,
          backup: backupCount,
          match: count === backupCount
        };
      } else {
        results[table] = { status: 'no_backup', current: count };
      }
      
    } catch (err) {
      results[table] = { status: 'error', error: err.message };
    }
  }
  
  // Exibir resultados
  console.log('\n📊 Resultados da verificação:');
  Object.entries(results).forEach(([table, result]) => {
    const icon = result.status === 'ok' ? '✅' : 
                result.status === 'warning' ? '⚠️' : '❌';
    
    if (result.status === 'ok') {
      console.log(`  ${icon} ${table}: ${result.current} registros (✓ match)`);
    } else if (result.status === 'warning') {
      console.log(`  ${icon} ${table}: ${result.current} atual vs ${result.backup} backup`);
    } else {
      console.log(`  ${icon} ${table}: ${result.error || 'erro desconhecido'}`);
    }
  });
  
  return results;
}

/**
 * Executar restore completo
 */
async function runRestore(backupName) {
  console.log('🔄 Iniciando restore do sistema Grifo Vistorias...');
  
  try {
    // Verificar credenciais
    if (!SUPABASE_SERVICE_KEY) {
      console.error('❌ SUPABASE_SERVICE_KEY não configurada');
      console.log('💡 Configure a variável de ambiente SUPABASE_SERVICE_KEY');
      process.exit(1);
    }
    
    // Listar backups se não especificado
    if (!backupName) {
      const backups = listBackups();
      if (backups.length === 0) {
        console.error('❌ Nenhum backup disponível');
        process.exit(1);
      }
      
      console.log('\n💡 Use: node restore.js <nome-do-backup>');
      process.exit(0);
    }
    
    // Localizar backup
    const backupPath = path.join(BACKUP_DIR, backupName);
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Backup não encontrado: ${backupName}`);
      process.exit(1);
    }
    
    // Extrair se necessário
    const extractedPath = await extractBackup(backupPath);
    
    // Validar backup
    const manifest = validateBackup(extractedPath);
    
    // Confirmar restore
    const confirmed = await confirmRestore();
    if (!confirmed) {
      console.log('❌ Restore cancelado pelo usuário');
      process.exit(0);
    }
    
    // Criar backup de segurança
    await createSafetyBackup();
    
    // Executar restore
    await restoreTables(extractedPath);
    
    // Verificar integridade
    const verification = await verifyRestore(extractedPath);
    
    console.log('\n✅ Restore concluído!');
    console.log(`📋 Backup restaurado: ${manifest.backup_id}`);
    console.log(`📅 Data do backup: ${manifest.created_at}`);
    
    // Resumo da verificação
    const totalTables = Object.keys(verification).length;
    const okTables = Object.values(verification).filter(r => r.status === 'ok').length;
    const warningTables = Object.values(verification).filter(r => r.status === 'warning').length;
    const errorTables = Object.values(verification).filter(r => r.status === 'error').length;
    
    console.log(`\n📊 Resumo: ${okTables}/${totalTables} tabelas OK`);
    if (warningTables > 0) {
      console.log(`⚠️ ${warningTables} tabelas com divergências`);
    }
    if (errorTables > 0) {
      console.log(`❌ ${errorTables} tabelas com erros`);
    }
    
  } catch (error) {
    console.error('❌ Erro durante o restore:', error.message);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const backupName = process.argv[2];
  runRestore(backupName);
}

module.exports = { runRestore, listBackups };