const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { supabase } = require('../config/supabase.js');
// const { logger } = require('../config/logger.js');

const router = express.Router();

// Rate limiting específico para endpoints públicos (mais restritivo)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 tentativas por IP a cada 15 minutos
  message: {
    error: 'Muitas tentativas de contestação. Tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Esquema de validação para contestação pública
const publicContestSchema = z.object({
  tipo: z.enum(['technical', 'commercial', 'other']).default('technical'),
  prioridade: z.enum(['low', 'medium', 'high']).default('medium'),
  motivo: z.string().min(10, 'Motivo deve ter pelo menos 10 caracteres'),
  descricao: z.string().optional(),
  contestant_name: z.string().min(2, 'Nome é obrigatório'),
  contestant_email: z.string().email('Email inválido'),
  contestant_phone: z.string().optional(),
  attachments: z.array(z.string().url()).optional().default([])
});

/**
 * @swagger
 * /api/public/contest/{token}:
 *   get:
 *     summary: Validar token de contestação e obter dados da vistoria
 *     tags: [Public Contest]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token único de contestação
 *     responses:
 *       200:
 *         description: Token válido e dados da vistoria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     vistoria:
 *                       type: object
 *                     contest_link_id:
 *                       type: string
 *       400:
 *         description: Token inválido ou expirado
 *       404:
 *         description: Token não encontrado
 */
router.get('/contest/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Token é obrigatório',
        code: 'INVALID_TOKEN'
      });
    }

    // Validar token usando a função do banco
    const { data: validation, error: validationError } = await supabase
      .rpc('validate_contest_token', {
        p_token: token
      });

    if (validationError) {
      console.error('Error validating contest token:', validationError);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }

    if (!validation || validation.length === 0 || !validation[0].is_valid) {
      return res.status(400).json({
        success: false,
        error: 'Token inválido, expirado ou já utilizado',
        code: 'INVALID_TOKEN'
      });
    }

    const validationData = validation[0];

    // Buscar dados da vistoria
    const { data: vistoria, error: vistoriaError } = await supabase
      .from('vistorias')
      .select(`
        id,
        status,
        data_vistoria,
        created_at,
        imovel:imoveis(
          id,
          endereco,
          cidade,
          estado,
          cep,
          tipo
        ),
        empresa:empresas(
          id,
          nome,
          email,
          telefone
        )
      `)
      .eq('id', validationData.vistoria_id)
      .single();

    if (vistoriaError || !vistoria) {
      console.error('Error fetching vistoria:', vistoriaError);
      return res.status(404).json({
        success: false,
        error: 'Vistoria não encontrada',
        code: 'VISTORIA_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        vistoria,
        contest_link_id: validationData.contest_link_id,
        expires_at: validationData.expires_at
      }
    });

  } catch (error) {
    console.error('Error in public contest validation:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/public/contest/{token}:
 *   post:
 *     summary: Criar contestação via token público
 *     tags: [Public Contest]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token único de contestação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - contestant_name
 *               - contestant_email
 *               - contestant_phone
 *               - contest_type
 *               - description
 *             properties:
 *               contestant_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               contestant_email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *               contestant_phone:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 20
 *               contest_type:
 *                 type: string
 *                 enum: [technical, commercial, other]
 *               description:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *     responses:
 *       201:
 *         description: Contestação criada com sucesso
 *       400:
 *         description: Dados inválidos ou token expirado
 *       409:
 *         description: Token já foi utilizado
 */
router.post('/contest/:token', publicLimiter, async (req, res) => {
  try {
    const { token } = req.params;
    
    // Validar dados de entrada
    const validationResult = publicContestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors
      });
    }

    const contestData = validationResult.data;

    // Validar token
    const { data: validation, error: validationError } = await supabase
      .rpc('validate_contest_token', {
        p_token: token
      });

    if (validationError) {
      console.error('Error validating contest token:', validationError);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }

    if (!validation || validation.length === 0 || !validation[0].is_valid) {
      return res.status(400).json({
        success: false,
        error: 'Token inválido, expirado ou já utilizado',
        code: 'INVALID_TOKEN'
      });
    }

    const validationData = validation[0];

    // Verificar se o token já foi usado
    const { data: contestLink, error: linkError } = await supabase
      .from('contest_links')
      .select('is_used, used_at')
      .eq('id', validationData.contest_link_id)
      .single();

    if (linkError) {
      console.error('Error checking contest link:', linkError);
      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }

    if (contestLink.is_used) {
      return res.status(409).json({
        success: false,
        error: 'Este link de contestação já foi utilizado',
        code: 'TOKEN_ALREADY_USED',
        used_at: contestLink.used_at
      });
    }

    // Criar contestação
    const { data: contestacao, error: contestError } = await supabase
      .from('contestacoes')
      .insert({
        empresa_id: validationData.empresa_id,
        vistoria_id: validationData.vistoria_id,
        usuario_id: null, // Contestação pública não tem usuário
        tipo: contestData.tipo,
        prioridade: contestData.prioridade,
        motivo: contestData.motivo,
        descricao: contestData.descricao,
        status: 'pending',
        contestant_name: contestData.contestant_name,
        contestant_email: contestData.contestant_email,
        contestant_phone: contestData.contestant_phone,
        attachments: contestData.attachments || [],
        contest_link_id: validationData.contest_link_id,
        created_via: 'public_link'
      })
      .select()
      .single();

    if (contestError) {
      console.error('Error creating contest:', contestError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao criar contestação',
        code: 'CONTEST_CREATION_ERROR'
      });
    }

    // Marcar link como usado
    const { error: updateError } = await supabase
      .from('contest_links')
      .update({
        is_used: true,
        used_at: new Date().toISOString(),
        contestant_name: contestData.contestant_name,
        contestant_email: contestData.contestant_email,
        contestant_phone: contestData.contestant_phone
      })
      .eq('id', validationData.contest_link_id);

    if (updateError) {
      console.error('Error updating contest link:', updateError);
      // Não falhar a operação, apenas logar o erro
    }

    // Log da contestação criada
    console.log('Public contest created:', {
      contest_id: contestacao.id,
      vistoria_id: validationData.vistoria_id,
      contestant_email: contestData.contestant_email,
      token: token.substring(0, 8) + '...' // Log parcial do token por segurança
    });

    res.status(201).json({
      success: true,
      message: 'Contestação criada com sucesso',
      data: {
        contest_id: contestacao.id,
        status: contestacao.status,
        created_at: contestacao.created_at
      }
    });

  } catch (error) {
    console.error('Error in public contest creation:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
