const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { supabase } = require('../config/supabase.js');
// const { logger, authLogger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const { 
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError
} = require('../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../middleware/validation.js');
const { authSupabase } = require('../middleware/auth.js');
const { 
  notifyNewInspectionRequest,
  notifyInspectionStatusChange,
  notifyInspectionScheduled
} = require('../utils/notifications.js');

const router = express.Router();

// Configuração do multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Permitir apenas certos tipos de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'), false);
    }
  }
});

// Middleware para autenticação de clientes
const authenticateClient = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new AuthenticationError('Token de acesso requerido');
  }

  const { data: session, error } = await supabase
    .from('client_sessions')
    .select('client_id, expires_at')
    .eq('session_token', token)
    .single();

  if (error || !session) {
    console.log('Token inválido fornecido', { token: token.substring(0, 10) + '...' });
    throw new AuthenticationError('Token inválido');
  }

  if (new Date(session.expires_at) < new Date()) {
    await supabase
      .from('client_sessions')
      .delete()
      .eq('session_token', token);
    
    console.log('Sessão expirada', { clientId: session.client_id });
    throw new AuthenticationError('Sessão expirada');
  }

  await supabase
    .from('client_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_token', token);

  req.clientId = session.client_id;
  next();
});

// Esquemas de validação
const inspectionRequestSchemas = {
  create: z.object({
    property_address: z.string().min(1, 'Endereço é obrigatório'),
    property_type: z.enum(['residential', 'commercial', 'industrial'], {
      errorMap: () => ({ message: 'Tipo de propriedade inválido' })
    }),
    inspection_type: z.enum(['purchase', 'sale', 'insurance', 'maintenance', 'other'], {
      errorMap: () => ({ message: 'Tipo de vistoria inválido' })
    }),
    description: z.string().optional(),
    preferred_date: z.string().optional(),
    contact_phone: z.string().min(1, 'Telefone de contato é obrigatório'),
    contact_email: commonSchemas.email.optional(),
    urgency_level: z.enum(['low', 'medium', 'high']).default('medium')
  }),
  
  updateStatus: z.object({
    status: z.enum(['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'], {
      errorMap: () => ({ message: 'Status inválido' })
    }),
    scheduled_date: z.string().optional(),
    assigned_inspector: z.string().uuid().optional(),
    notes: z.string().optional()
  }),
  
  comment: z.object({
    comment: z.string().min(1, 'Comentário é obrigatório')
  })
};

// ROTAS PARA CLIENTES

// Criar nova solicitação de vistoria
router.post('/', 
  authenticateClient, 
  validateRequest(inspectionRequestSchemas.create),
  asyncHandler(async (req, res) => {
    const validatedData = req.validatedData;

    const { data: request, error } = await supabase
      .from('inspection_requests')
      .insert({
        client_id: req.clientId,
        ...validatedData,
        status: 'pending'
      })
      .select(`
        *,
        clients!inner(name, email, phone)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar solicitação de vistoria', { error, clientId: req.clientId });
      throw new AppError('Erro ao criar solicitação', 500);
    }

    // Criar workflow de aprovação para a nova solicitação
    const { error: workflowError } = await supabase
      .from('approval_workflows')
      .insert({
        inspection_request_id: request.id,
        status: 'pending_approval',
        priority: validatedData.urgency_level || 'medium',
        created_by: req.clientId
      });

    if (workflowError) {
      console.error('Erro ao criar workflow de aprovação', { error: workflowError, requestId: request.id });
      // Não falhar a criação da solicitação por causa do workflow
    }

    // Criar notificação para administradores
    await notifyNewInspectionRequest(request.id, request.clients.name);

    // Log de auditoria
    console.log('Nova solicitação de vistoria criada', {
      requestId: request.id,
      clientId: req.clientId,
      propertyAddress: validatedData.property_address
    });

    res.status(201).json({
      message: 'Solicitação criada com sucesso',
      request
    });
  })
);

// Listar solicitações do cliente
router.get('/my-requests', 
  authenticateClient, 
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('inspection_requests')
      .select(`
        *,
        users(name, email)
      `, { count: 'exact' })
      .eq('client_id', req.clientId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: requests, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao listar solicitações do cliente', { error, clientId: req.clientId });
      throw new AppError('Erro ao listar solicitações', 500);
    }

    res.json({
      requests,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  })
);

// Obter detalhes de uma solicitação específica (cliente)
router.get('/:id/details', 
  authenticateClient, 
  asyncHandler(async (req, res) => {
    const { data: request, error } = await supabase
      .from('inspection_requests')
      .select(`
        *,
        users(name, email, phone),
        inspection_files(*),
        inspection_comments(
          *,
          users(name),
          clients(name)
        )
      `)
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();

    if (error || !request) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    res.json({ request });
  })
);

// Adicionar comentário à solicitação (cliente)
router.post('/:id/comments', 
  authenticateClient, 
  validateRequest(inspectionRequestSchemas.comment),
  asyncHandler(async (req, res) => {
    const validatedData = req.validatedData;

    // Verificar se a solicitação pertence ao cliente
    const { data: request, error: requestError } = await supabase
      .from('inspection_requests')
      .select('id')
      .eq('id', req.params.id)
      .eq('client_id', req.clientId)
      .single();

    if (requestError || !request) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    const { data: comment, error } = await supabase
      .from('inspection_comments')
      .insert({
        inspection_request_id: req.params.id,
        client_id: req.clientId,
        comment: validatedData.comment
      })
      .select(`
        *,
        clients(name)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar comentário do cliente', { error, requestId: req.params.id, clientId: req.clientId });
      throw new AppError('Erro ao adicionar comentário', 500);
    }

    // Log de auditoria
    console.log('Comentário adicionado pelo cliente', {
      requestId: req.params.id,
      clientId: req.clientId,
      commentId: comment.id
    });

    res.status(201).json({
      message: 'Comentário adicionado com sucesso',
      comment
    });
  })
);

// ROTAS ADMINISTRATIVAS

// Listar todas as solicitações (admin)
router.get('/', 
  authSupabase, 
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status;
    const inspector_id = req.query.inspector_id;
    const search = req.query.search || '';
    const offset = (page - 1) * limit;

    let query = supabase
      .from('inspection_requests')
      .select(`
        *,
        clients(name, email, phone)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }

    if (inspector_id) {
      query = query.eq('inspector_id', inspector_id);
    }

    if (search) {
      query = query.or(`property_address.ilike.%${search}%,clients.name.ilike.%${search}%`);
    }

    const { data: requests, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Erro ao listar solicitações administrativas', { 
        error: error, 
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        errorCode: error.code,
        userId: req.user?.id,
        query: 'inspection_requests with clients and users join'
      });
      throw new AppError(`Erro ao listar solicitações: ${error.message || 'Erro desconhecido'}`, 500);
    }

    res.json({
      requests,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  })
);

// Obter detalhes de uma solicitação específica (admin)
router.get('/:id', 
  authSupabase, 
  asyncHandler(async (req, res) => {
    const { data: request, error } = await supabase
      .from('inspection_requests')
      .select(`
        *,
        clients!inner(name, email, phone, document, address, city, state),
        users(name, email, phone),
        inspection_files(*),
        inspection_comments(
          *,
          users(name),
          clients(name)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !request) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    res.json({ request });
  })
);

// Atualizar status da solicitação (admin)
router.put('/:id/status', 
  authSupabase, 
  validateRequest(inspectionRequestSchemas.updateStatus),
  asyncHandler(async (req, res) => {
    const validatedData = req.validatedData;

    const updateData = {
      status: validatedData.status,
      updated_at: new Date().toISOString()
    };

    if (validatedData.inspector_id) {
      updateData.inspector_id = validatedData.inspector_id;
    }

    const { data: request, error } = await supabase
      .from('inspection_requests')
      .update(updateData)
      .eq('id', req.params.id)
      .select(`
        *,
        clients!inner(name, email)
      `)
      .single();

    if (error) {
      console.error('Erro ao atualizar status da solicitação', { error, requestId: req.params.id, userId: req.user.id });
      throw new AppError('Erro ao atualizar status', 500);
    }

    // Atualizar workflow de aprovação se existir
    if (validatedData.status === 'scheduled') {
      await supabase
        .from('approval_workflows')
        .update({
          status: 'approved',
          approved_by: req.user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('inspection_request_id', req.params.id);
    } else if (validatedData.status === 'cancelled') {
      await supabase
        .from('approval_workflows')
        .update({
          status: 'rejected',
          rejected_by: req.user.id,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('inspection_request_id', req.params.id);
    }

    // Criar notificação para o cliente
    await notifyInspectionStatusChange(request.id, request.client_id, validatedData.status, validatedData.inspector_id);

    // Adicionar comentário se fornecido
    if (validatedData.notes) {
      await supabase
        .from('inspection_comments')
        .insert({
          inspection_request_id: req.params.id,
          user_id: req.user.id,
          comment: validatedData.notes
        });
    }

    // Log de auditoria
    console.log('Status da solicitação atualizado', {
      requestId: req.params.id,
      newStatus: validatedData.status,
      userId: req.user.id,
      inspectorId: validatedData.inspector_id
    });

    res.json({
      message: 'Status atualizado com sucesso',
      request
    });
  })
);

// Listar arquivos da solicitação (admin)
router.get('/:id/files', 
  authSupabase, 
  asyncHandler(async (req, res) => {
    // Verificar se a solicitação existe
    const { data: request, error: requestError } = await supabase
      .from('inspection_requests')
      .select('id, client_id')
      .eq('id', req.params.id)
      .single();

    if (requestError || !request) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    // Buscar arquivos da solicitação
    const { data: files, error: filesError } = await supabase
      .from('inspection_files')
      .select(`
        id,
        file_name,
        file_size,
        file_type,
        mime_type,
        is_client_visible,
        created_at,
        uploaded_by,
        users(name)
      `)
      .eq('inspection_request_id', req.params.id)
      .order('created_at', { ascending: false });

    if (filesError) {
      console.error('Erro ao buscar arquivos da solicitação', { error: filesError, requestId: req.params.id });
      throw new AppError('Erro ao buscar arquivos', 500);
    }

    res.json({
      message: 'Arquivos carregados com sucesso',
      data: files || []
    });
  })
);

// Upload de arquivos da vistoria (admin)
router.post('/:id/files', 
  authSupabase, 
  upload.array('files', 10), 
  asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      throw new ValidationError('Nenhum arquivo enviado');
    }

    // Verificar se a solicitação existe
    const { data: request, error: requestError } = await supabase
      .from('inspection_requests')
      .select('id, client_id')
      .eq('id', req.params.id)
      .single();

    if (requestError || !request) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    const uploadedFiles = [];

    for (const file of req.files) {
      // Upload para Supabase Storage
      const fileName = `${Date.now()}-${file.originalname}`;
      const filePath = `inspection-files/${req.params.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('inspection-files')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Erro no upload de arquivo', { error: uploadError, fileName: file.originalname });
        continue;
      }

      // Salvar informações do arquivo no banco
      const { data: fileRecord, error: fileError } = await supabase
        .from('inspection_files')
        .insert({
          inspection_request_id: req.params.id,
          file_name: file.originalname,
          file_path: filePath,
          file_size: file.size,
          file_type: file.mimetype,
          uploaded_by: req.user.id
        })
        .select()
        .single();

      if (!fileError) {
        uploadedFiles.push(fileRecord);
      }
    }

    if (uploadedFiles.length > 0) {
      // Criar notificação para o cliente
      // Notificação de upload de arquivo será implementada conforme necessário
    }

    // Log de auditoria
    console.log('Arquivos enviados para solicitação', {
      requestId: req.params.id,
      filesCount: uploadedFiles.length,
      userId: req.user.id
    });

    res.status(201).json({
      message: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`,
      files: uploadedFiles
    });
  })
);

// Listar comentários da solicitação (admin)
router.get('/:id/comments', 
  authSupabase, 
  asyncHandler(async (req, res) => {
    // Verificar se a solicitação existe
    const { data: request, error: requestError } = await supabase
      .from('inspection_requests')
      .select('id, client_id')
      .eq('id', req.params.id)
      .single();

    if (requestError || !request) {
      throw new AppError('Solicitação não encontrada', 404);
    }

    // Buscar comentários da solicitação
    const { data: comments, error: commentsError } = await supabase
      .from('inspection_comments')
      .select(`
        id,
        comment,
        created_at,
        user_id,
        users(name, user_type)
      `)
      .eq('inspection_request_id', req.params.id)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Erro ao buscar comentários da solicitação', { error: commentsError, requestId: req.params.id });
      throw new AppError('Erro ao buscar comentários', 500);
    }

    res.json({
      message: 'Comentários carregados com sucesso',
      data: comments || []
    });
  })
);

// Adicionar comentário à solicitação (admin)
router.post('/:id/comments', 
  authSupabase, 
  validateRequest(inspectionRequestSchemas.comment),
  asyncHandler(async (req, res) => {
    const validatedData = req.validatedData;

    const { data: comment, error } = await supabase
      .from('inspection_comments')
      .insert({
        inspection_request_id: req.params.id,
        user_id: req.user.id,
        comment: validatedData.comment
      })
      .select(`
        *,
        users(name)
      `)
      .single();

    if (error) {
      console.error('Erro ao criar comentário administrativo', { error, requestId: req.params.id, userId: req.user.id });
      throw new AppError('Erro ao adicionar comentário', 500);
    }

    // Criar notificação para o cliente sobre novo comentário
    const { data: requestData } = await supabase
      .from('inspection_requests')
      .select('client_id')
      .eq('id', req.params.id)
      .single();

    if (requestData) {
      // Notificação de comentário será implementada conforme necessário
    }

    // Log de auditoria
    console.log('Comentário administrativo adicionado', {
      requestId: req.params.id,
      userId: req.user.id,
      commentId: comment.id
    });

    res.status(201).json({
      message: 'Comentário adicionado com sucesso',
      comment
    });
  })
);

// Download de arquivo
router.get('/files/:fileId/download', asyncHandler(async (req, res) => {
  // Verificar autenticação (cliente ou admin)
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new AuthenticationError('Token de acesso requerido');
  }

  let userId = null;
  let clientId = null;

  // Tentar autenticação como admin
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.userId) {
      userId = decoded.userId;
    }
  } catch {
    // Tentar autenticação como cliente
    const { data: session } = await supabase
      .from('client_sessions')
      .select('client_id')
      .eq('session_token', token)
      .single();
    
    if (session) {
      clientId = session.client_id;
    }
  }

  if (!userId && !clientId) {
    console.log('Tentativa de download com token inválido', { fileId: req.params.fileId });
    throw new AuthenticationError('Token inválido');
  }

  // Buscar informações do arquivo
  const { data: file, error } = await supabase
    .from('inspection_files')
    .select(`
      *,
      inspection_requests!inner(client_id)
    `)
    .eq('id', req.params.fileId)
    .single();

  if (error || !file) {
    throw new AppError('Arquivo não encontrado', 404);
  }

  // Verificar permissão
  if (clientId && file.inspection_requests.client_id !== clientId) {
    console.log('Tentativa de acesso negado ao arquivo', { 
      fileId: req.params.fileId, 
      clientId, 
      fileClientId: file.inspection_requests.client_id 
    });
    throw new AppError('Acesso negado', 403);
  }

  // Download do arquivo
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('inspection-files')
    .download(file.file_path);

  if (downloadError) {
    console.error('Erro no download do arquivo', { error: downloadError, fileId: req.params.fileId });
    throw new AppError('Erro ao baixar arquivo', 500);
  }

  // Log de auditoria
  console.log('Arquivo baixado', {
    fileId: file.id,
    fileName: file.file_name,
    downloadedBy: userId ? `usuário ${userId}` : `cliente ${clientId}`
  });

  res.setHeader('Content-Type', file.file_type);
  res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
  res.send(Buffer.from(await fileData.arrayBuffer()));
}));

module.exports = router;
