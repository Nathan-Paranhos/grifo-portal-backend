// Arquivo de teste para debugar o problema com tenants.js
console.log('Iniciando teste do tenants.js...');

try {
  console.log('Carregando express...');
  const express = require('express');
  console.log('✅ Express carregado');
  
  console.log('Carregando zod...');
  const { z } = require('zod');
  console.log('✅ Zod carregado');
  
  console.log('Carregando supabase...');
  const { supabase } = require('./src/config/supabase');
  console.log('✅ Supabase carregado');
  
  console.log('Carregando logger...');
  const { logger } = require('./src/config/logger');
  console.log('✅ Logger carregado');
  
  console.log('Carregando errorHandler...');
  const { asyncHandler, AppError, ValidationError, NotFoundError } = require('./src/middleware/errorHandler');
  console.log('✅ ErrorHandler carregado');
  
  console.log('Carregando validation...');
  const { validateRequest, commonSchemas } = require('./src/middleware/validation');
  console.log('✅ Validation carregado');
  
  console.log('Carregando auth...');
  const { authSupabase, requireRole } = require('./src/middleware/auth');
  console.log('✅ Auth carregado');
  
  console.log('Carregando tenants.js...');
  const tenantRoutes = require('./src/routes/v1/tenants.js');
  console.log('✅ Tenants.js carregado com sucesso!');
  
} catch (error) {
  console.error('❌ Erro ao carregar tenants.js:', error);
  console.error('Stack trace:', error.stack);
}