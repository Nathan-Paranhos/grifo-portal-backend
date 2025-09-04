const express = require('express');
const multer = require('multer');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js'); // Temporarily disabled to avoid circular dependency
const {
  asyncHandler,
  AppError,
  ValidationError,
  NotFoundError
} = require('../middleware/errorHandler.js');
const authModule = require('../middleware/auth.js');
const { validateRequest, commonSchemas } = require('../middleware/validation.js');
const { imageCompressionMiddleware } = require('../middleware/imageCompression.js');
const fileVersioningMiddleware = require('../middleware/fileVersioning');
const { z } = require('zod');
const path = require('path');
const { v4 as uuidv4 } = require('uuid');
const { authMiddleware } = authModule;

// Upload validation schemas
const uploadSchemas = {
  uploadType: z.enum([
    'inspection_photos',
    'property_documents',
    'contest_evidence',
    'user_avatar',
    'company_logo',
    'report_attachments'
  ]),
  description: z
    .string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres'),
  mimeType: z.string(),
  sortBy: z.enum(['created_at', 'filename', 'file_size']),
  bulkDelete: z.object({
    file_ids: z
      .array(commonSchemas.uuid)
      .min(1, 'Pelo menos um arquivo deve ser especificado')
  })
};

const router = express.Router();

// All upload routes require authentication
router.use(authMiddleware);

// Configure multer for file uploads
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  const allowedTypes = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
      '.docx'
    ],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
      '.xlsx'
    ],
    'text/plain': ['.txt'],
    'text/csv': ['.csv']
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new ValidationError('Tipo de arquivo não permitido'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
  }
});

/**
 * @swagger
 * /api/uploads:
 *   post:
 *     tags: [Uploads]
 *     summary: Upload de arquivos
 *     description: |
 *       Faz upload de um ou múltiplos arquivos para o Supabase Storage.
 *       Suporta imagens (JPEG, PNG, GIF, WebP) e documentos (PDF, DOC, DOCX, XLS, XLSX, TXT, CSV).
 *       Limite de 10MB por arquivo e máximo 10 arquivos por requisição.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - files
 *               - upload_type
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Arquivos para upload (máximo 10 arquivos, 10MB cada)
 *               upload_type:
 *                 type: string
 *                 enum: [inspection_photos, property_documents, contest_evidence, user_avatar, company_logo, report_attachments]
 *                 description: Tipo de upload para organização no storage
 *                 example: "inspection_photos"
 *               related_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID relacionado (vistoria, propriedade, contestação, etc.)
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               description:
 *                 type: string
 *                 description: Descrição opcional dos arquivos
 *                 example: "Fotos da fachada do imóvel"
 *     responses:
 *       201:
 *         description: Arquivos enviados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Arquivos enviados com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     files:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           filename:
 *                             type: string
 *                           original_name:
 *                             type: string
 *                           file_size:
 *                             type: integer
 *                           mime_type:
 *                             type: string
 *                           storage_path:
 *                             type: string
 *                           public_url:
 *                             type: string
 *                           upload_type:
 *                             type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       413:
 *         description: Arquivo muito grande
 */
router.post(
  '/',
  upload.array('files', 10),
  imageCompressionMiddleware,
  fileVersioningMiddleware,
  validateRequest({
    body: {
      upload_type: uploadSchemas.uploadType,
      related_id: commonSchemas.uuid.optional(),
      description: uploadSchemas.description.optional()
    }
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const {
      upload_type: uploadType,
      related_id: relatedId,
      description
    } = req.body;
    const files = req.files;

    if (!files || files.length === 0) {
      throw new ValidationError('Nenhum arquivo foi enviado');
    }

    try {
      const uploadedFiles = [];
      const uploadPromises = files.map(async file => {
        const fileId = uuidv4();
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const filename = `${fileId}${fileExtension}`;
        const storagePath = `${user.company_id}/${uploadType}/${filename}`;

        // Upload to Supabase Storage
        const { error: storageError } = await supabase.storage
          .from('uploads')
          .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) {
          console.error('Storage upload error:', storageError);
          throw new AppError(`Erro ao enviar arquivo ${file.originalname}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('uploads')
          .getPublicUrl(storagePath);

        // Save file metadata to database
        const { data: fileRecord, error: dbError } = await supabase
          .from('uploads')
          .insert({
            id: fileId,
            filename,
            original_name: file.originalname,
            file_size: file.size,
            mime_type: file.mimetype,
            storage_path: storagePath,
            public_url: urlData.publicUrl,
            upload_type: uploadType,
            related_id: relatedId || null,
            description: description || null,
            company_id: user.company_id,
            uploaded_by: user.id
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database insert error:', dbError);
          // Try to delete the uploaded file from storage
          await supabase.storage.from('uploads').remove([storagePath]);
          throw new AppError(
            `Erro ao salvar metadados do arquivo ${file.originalname}`
          );
        }

        return fileRecord;
      });

      const results = await Promise.all(uploadPromises);
      uploadedFiles.push(...results);

      console.log('Files uploaded', {
        userId: user.id,
        companyId: user.company_id,
        uploadType,
        relatedId,
        fileCount: uploadedFiles.length,
        totalSize: files.reduce((sum, file) => sum + file.size, 0),
        filenames: uploadedFiles.map(f => f.original_name)
      });

      res.status(201).json({
        success: true,
        message: `${uploadedFiles.length} arquivo(s) enviado(s) com sucesso`,
        data: {
          files: uploadedFiles
        }
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      console.error('Upload error:', error);
      throw new AppError('Erro ao processar upload de arquivos');
    }
  })
);

/**
 * @swagger
 * /api/uploads:
 *   get:
 *     tags: [Uploads]
 *     summary: Listar uploads
 *     description: |
 *       Lista todos os uploads da empresa com filtros e paginação.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: upload_type
 *         schema:
 *           type: string
 *           enum: [inspection_photos, property_documents, contest_evidence, user_avatar, company_logo, report_attachments]
 *       - in: query
 *         name: related_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: mime_type
 *         schema:
 *           type: string
 *         description: Filtrar por tipo MIME
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome do arquivo ou descrição
 *       - in: query
 *         name: uploaded_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: uploaded_to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, filename, file_size]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Lista de uploads
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     uploads:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Upload'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 */
router.get(
  '/',
  validateRequest({
    query: {
      ...commonSchemas.pagination,
      ...commonSchemas.search,
      upload_type: uploadSchemas.uploadType.optional(),
      related_id: commonSchemas.uuid.optional(),
      mime_type: uploadSchemas.mimeType.optional(),
      uploaded_from: commonSchemas.date.optional(),
      uploaded_to: commonSchemas.date.optional(),
      sortBy: uploadSchemas.sortBy.optional(),
      sortOrder: commonSchemas.sortOrder.optional()
    }
  }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const {
      page = 1,
      limit = 20,
      search,
      upload_type: uploadType,
      related_id: relatedId,
      mime_type: mimeType,
      uploaded_from: uploadedFrom,
      uploaded_to: uploadedTo,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    try {
      let query = supabase
        .from('uploads')
        .select(
          `
          id,
          filename,
          original_name,
          file_size,
          mime_type,
          public_url,
          upload_type,
          related_id,
          description,
          created_at,
          users!uploads_uploaded_by_fkey(
            id,
            name as uploader_name
          )
        `,
          { count: 'exact' }
        )
        .eq('company_id', user.company_id);

      // Apply filters
      if (uploadType) {
        query = query.eq('upload_type', uploadType);
      }

      if (relatedId) {
        query = query.eq('related_id', relatedId);
      }

      if (mimeType) {
        query = query.eq('mime_type', mimeType);
      }

      if (uploadedFrom) {
        query = query.gte('created_at', uploadedFrom);
      }

      if (uploadedTo) {
        const endDate = new Date(uploadedTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDate.toISOString());
      }

      if (search) {
        query = query.or(`
          original_name.ilike.%${search}%,
          description.ilike.%${search}%
        `);
      }

      // Apply sorting
      const ascending = sortOrder === 'asc';
      query = query.order(sortBy, { ascending });

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: uploads, error, count } = await query;

      if (error) {
        console.error('Uploads list error:', error);
        throw new AppError('Erro ao carregar uploads');
      }

      // Process uploads to flatten nested data
      const processedUploads = uploads.map(upload => ({
        ...upload,
        uploader: {
          id: upload.users?.id,
          name: upload.users?.uploader_name
        },
        users: undefined
      }));

      const totalPages = Math.ceil(count / limit);

      console.log('Uploads listed', {
        userId: user.id,
        companyId: user.company_id,
        count,
        page,
        limit,
        filters: { uploadType, relatedId, mimeType, search }
      });

      res.json({
        success: true,
        data: {
          uploads: processedUploads,
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: count,
            pages: totalPages
          }
        }
      });
    } catch (error) {
      console.error('Uploads list error:', error);
      throw new AppError('Erro ao carregar uploads');
    }
  })
);

/**
 * @swagger
 * /api/uploads/{id}:
 *   get:
 *     tags: [Uploads]
 *     summary: Obter upload por ID
 *     description: |
 *       Retorna os detalhes completos de um upload específico.
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
 *         description: Detalhes do upload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     upload:
 *                       $ref: '#/components/schemas/Upload'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    try {
      const { data: upload, error } = await supabase
        .from('uploads')
        .select(
          `
          *,
          users!uploads_uploaded_by_fkey(
            id,
            name as uploader_name,
            email as uploader_email
          )
        `
        )
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (error || !upload) {
        throw new NotFoundError('Upload não encontrado');
      }

      // Process upload to flatten nested data
      const processedUpload = {
        ...upload,
        uploader: {
          id: upload.users?.id,
          name: upload.users?.uploader_name,
          email: upload.users?.uploader_email
        },
        users: undefined
      };

      console.log('Upload retrieved', {
        userId: user.id,
        uploadId: id,
        filename: upload.original_name
      });

      res.json({
        success: true,
        data: {
          upload: processedUpload
        }
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Upload get error:', error);
      throw new AppError('Erro ao carregar upload');
    }
  })
);

/**
 * @swagger
 * /api/uploads/{id}:
 *   delete:
 *     tags: [Uploads]
 *     summary: Excluir upload
 *     description: |
 *       Exclui um upload do sistema e do storage.
 *       Apenas o usuário que fez o upload, administradores e gerentes podem excluir.
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
 *         description: Upload excluído com sucesso
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:id',
  validateRequest({ params: { id: commonSchemas.uuid } }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { id } = req.params;

    try {
      // Check if upload exists and belongs to company
      const { data: upload, error: checkError } = await supabase
        .from('uploads')
        .select('id, storage_path, uploaded_by, original_name')
        .eq('id', id)
        .eq('company_id', user.company_id)
        .single();

      if (checkError || !upload) {
        throw new NotFoundError('Upload não encontrado');
      }

      // Check permissions: only uploader, admins, and managers can delete
      const canDelete =
        upload.uploaded_by === user.id ||
        ['admin', 'manager'].includes(user.role);

      if (!canDelete) {
        throw new ValidationError('Sem permissão para excluir este arquivo');
      }

      // Delete from storage first
      const { error: storageError } = await supabase.storage
        .from('uploads')
        .remove([upload.storage_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue with database deletion even if storage fails
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('uploads')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Database delete error:', dbError);
        throw new AppError('Erro ao excluir upload');
      }

      console.log('Upload deleted', {
        userId: user.id,
        uploadId: id,
        filename: upload.original_name,
        storagePath: upload.storage_path
      });

      res.json({
        success: true,
        message: 'Upload excluído com sucesso'
      });
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error;
      }
      console.error('Upload delete error:', error);
      throw new AppError('Erro ao excluir upload');
    }
  })
);

/**
 * @swagger
 * /api/uploads/bulk-delete:
 *   post:
 *     tags: [Uploads]
 *     summary: Excluir múltiplos uploads
 *     description: |
 *       Exclui múltiplos uploads do sistema e do storage.
 *       Apenas administradores e gerentes podem usar esta funcionalidade.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - upload_ids
 *             properties:
 *               upload_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 maxItems: 50
 *                 example: ["123e4567-e89b-12d3-a456-426614174000", "987fcdeb-51a2-43d1-b567-123456789abc"]
 *     responses:
 *       200:
 *         description: Uploads excluídos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted_count:
 *                       type: integer
 *                     failed_count:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.post(
  '/bulk-delete',
  validateRequest({ body: uploadSchemas.bulkDelete }),
  asyncHandler(async (req, res) => {
    const { user } = req;
    const { uploadIds } = req.body;

    // Only admins and managers can bulk delete
    if (!['admin', 'manager'].includes(user.role)) {
      throw new ValidationError(
        'Apenas administradores e gerentes podem excluir múltiplos arquivos'
      );
    }

    try {
      // Get all uploads to delete
      const { data: uploads, error: fetchError } = await supabase
        .from('uploads')
        .select('id, storage_path, original_name')
        .in('id', uploadIds)
        .eq('company_id', user.company_id);

      if (fetchError) {
        console.error('Bulk delete fetch error:', fetchError);
        throw new AppError('Erro ao buscar uploads para exclusão');
      }

      const results = {
        deleted_count: 0,
        failed_count: 0,
        errors: []
      };

      // Delete each upload
      for (const upload of uploads) {
        try {
          // Delete from storage
          const { error: storageError } = await supabase.storage
            .from('uploads')
            .remove([upload.storage_path]);

          if (storageError) {
            console.error('Storage delete error:', storageError);
            // Continue with database deletion even if storage fails
          }

          // Delete from database
          const { error: dbError } = await supabase
            .from('uploads')
            .delete()
            .eq('id', upload.id);

          if (dbError) {
            results.failed_count++;
            results.errors.push(
              `Erro ao excluir ${upload.original_name}: ${dbError.message}`
            );
          } else {
            results.deleted_count++;
          }
        } catch (error) {
          results.failed_count++;
          results.errors.push(
            `Erro ao excluir ${upload.original_name}: ${error.message}`
          );
        }
      }

      console.log('Bulk delete completed', {
        userId: user.id,
        requestedCount: uploadIds.length,
        foundCount: uploads.length,
        deletedCount: results.deleted_count,
        failedCount: results.failed_count
      });

      res.json({
        success: true,
        message: `${results.deleted_count} arquivo(s) excluído(s) com sucesso`,
        data: results
      });
    } catch (error) {
      if (error instanceof ValidationError || error instanceof AppError) {
        throw error;
      }
      console.error('Bulk delete error:', error);
      throw new AppError('Erro ao excluir uploads');
    }
  })
);

module.exports = router;

