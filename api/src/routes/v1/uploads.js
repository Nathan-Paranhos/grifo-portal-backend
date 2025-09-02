const express = require('express');
const multer = require('multer');
const { z } = require('zod');
const { supabase } = require('../../config/supabase.js');
// const { logger } = require('../../config/logger.js');
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError,
  AuthorizationError
} = require('../../middleware/errorHandler.js');
const { validateRequest, commonSchemas } = require('../../middleware/validation.js');
const { authSupabase } = require('../../middleware/auth.js');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Max 10 files per request
  },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          'Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, WebP, HEIC) ou PDF.'
        ),
        false
      );
    }
  }
});

// Validation schemas
const uploadSchemas = {
  uploadFiles: {
    body: z.object({
      context: z.enum([
        'vistoria',
        'contestacao',
        'profile',
        'company',
        'report'
      ]),
      context_id: commonSchemas.uuid.optional(),
      description: z.string().max(500).optional(),
      is_public: z.boolean().default(false)
    })
  },
  getFile: {
    params: z.object({
      id: commonSchemas.uuid
    })
  },
  updateFile: {
    params: z.object({
      id: commonSchemas.uuid
    }),
    body: z.object({
      description: z.string().max(500).optional(),
      is_public: z.boolean().optional()
    })
  },
  deleteFile: {
    params: z.object({
      id: commonSchemas.uuid
    })
  }
};

// Helper function to get storage bucket based on context
function getStorageBucket(context) {
  const buckets = {
    vistoria: 'photos',
    contestacao: 'uploads',
    profile: 'uploads',
    company: 'uploads',
    report: 'reports'
  };
  return buckets[context] || 'uploads';
}

// Helper function to generate file path
function generateFilePath(context, empresaId, userId, filename) {
  const timestamp = Date.now();
  const extension = filename.split('.').pop();
  const baseName = filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9]/g, '_');

  return `${context}/${empresaId}/${userId}/${timestamp}_${baseName}.${extension}`;
}

/**
 * @swagger
 * /api/v1/uploads:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload de arquivos
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: files
 *         type: file
 *         required: true
 *         description: Arquivos para upload (máximo 10 arquivos, 10MB cada)
 *       - in: formData
 *         name: context
 *         type: string
 *         required: true
 *         enum: [vistoria, contestacao, profile, company, report]
 *       - in: formData
 *         name: context_id
 *         type: string
 *         format: uuid
 *         description: ID do contexto (vistoria, contestação, etc.)
 *       - in: formData
 *         name: description
 *         type: string
 *         description: Descrição dos arquivos
 *       - in: formData
 *         name: is_public
 *         type: boolean
 *         default: false
 *     responses:
 *       201:
 *         description: Arquivos enviados com sucesso
 */
router.post(
  '/',
  authSupabase,
  upload.array('files', 10),
  validateRequest(uploadSchemas.uploadFiles),
  asyncHandler(async (req, res) => {
    const {
      context,
      context_id: contextId,
      description,
      is_public: isPublic = false
    } = req.body;
    const files = req.files;
    const empresaId = req.user.app_metadata.empresa_id;
    const userId = req.user.id;
    const userType = req.userType;

    if (!files || files.length === 0) {
      throw new ValidationError('Nenhum arquivo foi enviado');
    }

    // Validate context_id if required
    if (['vistoria', 'contestacao'].includes(context) && !contextId) {
      throw new ValidationError('context_id é obrigatório para este contexto');
    }

    // Verify context ownership/access
    if (contextId) {
      if (context === 'vistoria') {
        const { data: vistoria, error } = await supabase
          .from('vistorias')
          .select('id, solicitante_id, vistoriador_id')
          .eq('id', contextId)
          .eq('empresa_id', empresaId)
          .single();

        if (error || !vistoria) {
          throw new ValidationError('Vistoria não encontrada');
        }

        // Check if user has access to this inspection
        const hasAccess =
          userType === 'app_user'
            ? vistoria.solicitante_id === userId
            : vistoria.vistoriador_id === userId ||
              ['admin', 'manager'].includes(req.user.role);

        if (!hasAccess) {
          throw new AuthorizationError(
            'Você não tem permissão para fazer upload nesta vistoria'
          );
        }
      } else if (context === 'contestacao') {
        const { data: contestacao, error } = await supabase
          .from('contestacoes')
          .select('id, solicitante_id')
          .eq('id', contextId)
          .eq('empresa_id', empresaId)
          .single();

        if (error || !contestacao) {
          throw new ValidationError('Contestação não encontrada');
        }

        // Only the requester or admins can upload to contestations
        const hasAccess =
          userType === 'app_user'
            ? contestacao.solicitante_id === userId
            : ['admin', 'manager'].includes(req.user.role);

        if (!hasAccess) {
          throw new AuthorizationError(
            'Você não tem permissão para fazer upload nesta contestação'
          );
        }
      }
    }

    const bucket = getStorageBucket(context);
    const uploadedFiles = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        const filePath = generateFilePath(
          context,
          empresaId,
          userId,
          file.originalname
        );

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          errors.push({
            filename: file.originalname,
            error: uploadError.message
          });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);

        // Save file metadata to database
        const { data: fileRecord, error: dbError } = await supabase
          .from('uploads')
          .insert({
            filename: file.originalname,
            file_path: filePath,
            file_url: urlData.publicUrl,
            file_size: file.size,
            mime_type: file.mimetype,
            context,
            context_id: contextId,
            description,
            is_public: isPublic,
            uploaded_by: userId,
            empresa_id: empresaId,
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database insert error:', dbError);
          // Try to cleanup uploaded file
          await supabase.storage.from(bucket).remove([filePath]);
          errors.push({
            filename: file.originalname,
            error: 'Erro ao salvar metadados do arquivo'
          });
          continue;
        }

        uploadedFiles.push(fileRecord);
      } catch (error) {
        console.error('File processing error:', error);
        errors.push({ filename: file.originalname, error: error.message });
      }
    }

    if (uploadedFiles.length === 0) {
      throw new AppError('Nenhum arquivo foi processado com sucesso', 400);
    }

    console.log('Files uploaded successfully', {
      uploadedCount: uploadedFiles.length,
      errorCount: errors.length,
      context,
      userId,
      empresaId
    });

    const response = {
      success: true,
      message: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`,
      data: {
        uploaded: uploadedFiles,
        errors: errors.length > 0 ? errors : undefined
      }
    };

    res.status(201).json(response);
  })
);

/**
 * @swagger
 * /api/v1/uploads:
 *   get:
 *     tags: [Uploads]
 *     summary: Listar arquivos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *           enum: [vistoria, contestacao, profile, company, report]
 *       - in: query
 *         name: context_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Lista de arquivos
 */
router.get(
  '/',
  authSupabase,
  asyncHandler(async (req, res) => {
    const { context, context_id: contextId, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const empresaId = req.user.app_metadata.empresa_id;
    const userId = req.user.id;
    const userType = req.userType;
    const userData = req.user;

    let query = supabase
      .from('uploads')
      .select(
        `
        id,
        filename,
        file_url,
        file_size,
        mime_type,
        context,
        context_id,
        description,
        is_public,
        created_at,
        portal_users!uploads_uploaded_by_fkey(
          name,
          email
        ),
        app_users!uploads_uploaded_by_fkey(
          name,
          email
        )
      `,
        { count: 'exact' }
      )
      .eq('empresa_id', empresaId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Apply filters
    if (context) {
      query = query.eq('context', context);
    }

    if (contextId) {
      query = query.eq('context_id', contextId);
    }

    // Apply user-specific filters
    if (userType === 'app_user') {
      // App users can only see their own uploads or public ones
      query = query.or(`uploaded_by.eq.${userId},is_public.eq.true`);
    } else if (userType === 'portal_user' && userData.role === 'inspector') {
      // Inspectors can see uploads from their inspections
      query = query.or(`uploaded_by.eq.${userId},is_public.eq.true`);
    }

    const { data: uploads, error, count } = await query;

    if (error) {
      console.error('Error fetching uploads:', error);
      throw new AppError('Erro ao buscar arquivos', 500);
    }

    res.json({
      success: true,
      data: uploads,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/uploads/{id}:
 *   get:
 *     tags: [Uploads]
 *     summary: Obter arquivo por ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Dados do arquivo
 */
router.get(
  '/:id',
  authSupabase,
  validateRequest(uploadSchemas.getFile),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const empresaId = req.user.app_metadata.empresa_id;
    const userId = req.user.id;
    const userType = req.userType;
    const userData = req.user;

    const query = supabase
      .from('uploads')
      .select(
        `
        id,
        filename,
        file_url,
        file_size,
        mime_type,
        context,
        context_id,
        description,
        is_public,
        uploaded_by,
        created_at,
        portal_users!uploads_uploaded_by_fkey(
          name,
          email
        ),
        app_users!uploads_uploaded_by_fkey(
          name,
          email
        )
      `
      )
      .eq('id', id)
      .eq('empresa_id', empresaId);

    const { data: upload, error } = await query.single();

    if (error || !upload) {
      throw new NotFoundError('Arquivo não encontrado');
    }

    // Check access permissions
    const hasAccess =
      upload.is_public ||
      upload.uploaded_by === userId ||
      (userType === 'portal_user' &&
        ['admin', 'manager'].includes(userData.role));

    if (!hasAccess) {
      throw new AuthorizationError(
        'Você não tem permissão para acessar este arquivo'
      );
    }

    res.json({
      success: true,
      data: upload
    });
  })
);

/**
 * @swagger
 * /api/v1/uploads/{id}:
 *   put:
 *     tags: [Uploads]
 *     summary: Atualizar metadados do arquivo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Arquivo atualizado com sucesso
 */
router.put(
  '/:id',
  authSupabase,
  validateRequest(uploadSchemas.updateFile),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const empresaId = req.user.app_metadata.empresa_id;
    const userId = req.user.id;
    const userType = req.userType;
    const userData = req.user;

    // Get current upload
    const { data: currentUpload, error: fetchError } = await supabase
      .from('uploads')
      .select('id, uploaded_by')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (fetchError || !currentUpload) {
      throw new NotFoundError('Arquivo não encontrado');
    }

    // Check permissions - only uploader or admins can update
    const canUpdate =
      currentUpload.uploaded_by === userId ||
      (userType === 'portal_user' &&
        ['admin', 'manager'].includes(userData.role));

    if (!canUpdate) {
      throw new AuthorizationError(
        'Você não tem permissão para atualizar este arquivo'
      );
    }

    const { data: upload, error } = await supabase
      .from('uploads')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      console.error('Error updating upload:', error);
      throw new AppError('Erro ao atualizar arquivo', 500);
    }

    console.log('Upload updated successfully', {
      uploadId: id,
      updatedBy: userId,
      empresaId
    });

    res.json({
      success: true,
      message: 'Arquivo atualizado com sucesso',
      data: upload
    });
  })
);

/**
 * @swagger
 * /api/v1/uploads/{id}:
 *   delete:
 *     tags: [Uploads]
 *     summary: Excluir arquivo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Arquivo excluído com sucesso
 */
router.delete(
  '/:id',
  authSupabase,
  validateRequest(uploadSchemas.deleteFile),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const empresaId = req.user.app_metadata.empresa_id;
    const userId = req.user.id;
    const userType = req.userType;
    const userData = req.user;

    // Get current upload
    const { data: currentUpload, error: fetchError } = await supabase
      .from('uploads')
      .select('id, file_path, uploaded_by, context')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single();

    if (fetchError || !currentUpload) {
      throw new NotFoundError('Arquivo não encontrado');
    }

    // Check permissions - only uploader or admins can delete
    const canDelete =
      currentUpload.uploaded_by === userId ||
      (userType === 'portal_user' &&
        ['admin', 'manager'].includes(userData.role));

    if (!canDelete) {
      throw new AuthorizationError(
        'Você não tem permissão para excluir este arquivo'
      );
    }

    // Delete from storage
    const bucket = getStorageBucket(currentUpload.context);
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([currentUpload.file_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('uploads')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId);

    if (dbError) {
      console.error('Database deletion error:', dbError);
      throw new AppError('Erro ao excluir arquivo', 500);
    }

    console.log('Upload deleted successfully', {
      uploadId: id,
      deletedBy: userId,
      empresaId
    });

    res.json({
      success: true,
      message: 'Arquivo excluído com sucesso'
    });
  })
);

/**
 * @swagger
 * /api/v1/uploads/stats:
 *   get:
 *     tags: [Uploads]
 *     summary: Obter estatísticas de uploads
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas de uploads
 */
router.get(
  '/stats',
  authSupabase,
  asyncHandler(async (req, res) => {
    const empresaId = req.user.app_metadata.empresa_id;
    const userId = req.user.id;
    const userType = req.userType;
    const userData = req.user;

    let baseQuery = supabase
      .from('uploads')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId);

    // Apply user-specific filters for non-admin users
    if (userType === 'app_user') {
      baseQuery = baseQuery.eq('uploaded_by', userId);
    } else if (userType === 'portal_user' && userData.role === 'inspector') {
      baseQuery = baseQuery.eq('uploaded_by', userId);
    }

    // Get various stats in parallel
    const [totalResult, vistoriaResult, contestacaoResult, reportResult] =
      await Promise.all([
        baseQuery,
        supabase
          .from('uploads')
          .select('file_size', { count: 'exact' })
          .eq('empresa_id', empresaId)
          .eq('context', 'vistoria'),
        supabase
          .from('uploads')
          .select('file_size', { count: 'exact' })
          .eq('empresa_id', empresaId)
          .eq('context', 'contestacao'),
        supabase
          .from('uploads')
          .select('file_size', { count: 'exact' })
          .eq('empresa_id', empresaId)
          .eq('context', 'report')
      ]);

    // Calculate total storage used
    const { data: storageData } = await supabase
      .from('uploads')
      .select('file_size')
      .eq('empresa_id', empresaId);

    const totalStorage =
      storageData?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;

    const stats = {
      total_files: totalResult.count || 0,
      total_storage_bytes: totalStorage,
      total_storage_mb: Math.round((totalStorage / (1024 * 1024)) * 100) / 100,
      by_context: {
        vistoria: vistoriaResult.count || 0,
        contestacao: contestacaoResult.count || 0,
        report: reportResult.count || 0
      }
    };

    res.json({
      success: true,
      data: stats
    });
  })
);

module.exports = router;

