const express = require('express');
const { z } = require('zod');
const { supabase } = require('../../config/supabase.js');
// const { logger } = require('../../config/logger.js');
const { asyncHandler } = require('../../middleware/errorHandler.js');
const { validation } = require('../../middleware/validation.js');
const { requireRole } = require('../../middleware/auth.js');

const router = express.Router();

// ============================================================================
// SCHEMAS DE VALIDAÇÃO
// ============================================================================

const updateCompanySettingsSchema = z.object({
  notification_settings: z
    .object({
      email_notifications: z.boolean().optional(),
      push_notifications: z.boolean().optional(),
      sms_notifications: z.boolean().optional(),
      inspection_reminders: z.boolean().optional(),
      report_ready_notifications: z.boolean().optional()
    })
    .optional(),

  inspection_settings: z
    .object({
      auto_assign_inspectors: z.boolean().optional(),
      require_photos: z.boolean().optional(),
      min_photos_per_room: z.number().int().min(0).max(20).optional(),
      allow_offline_inspections: z.boolean().optional(),
      inspection_timeout_hours: z.number().int().min(1).max(168).optional(), // 1 hora a 1 semana
      quality_check_required: z.boolean().optional()
    })
    .optional(),

  report_settings: z
    .object({
      auto_generate_reports: z.boolean().optional(),
      include_photos_in_report: z.boolean().optional(),
      report_template: z.enum(['standard', 'detailed', 'summary']).optional(),
      watermark_reports: z.boolean().optional(),
      digital_signature_required: z.boolean().optional()
    })
    .optional(),

  integration_settings: z
    .object({
      webhook_url: z.string().url().optional().or(z.literal('')),
      webhook_events: z
        .array(
          z.enum([
            'inspection_created',
            'inspection_completed',
            'inspection_cancelled',
            'report_generated',
            'contestation_created'
          ])
        )
        .optional(),
      api_rate_limit: z.number().int().min(10).max(1000).optional()
    })
    .optional(),

  branding_settings: z
    .object({
      company_logo_url: z.string().url().optional().or(z.literal('')),
      primary_color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato #RRGGBB')
        .optional(),
      secondary_color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve estar no formato #RRGGBB')
        .optional(),
      custom_footer_text: z.string().max(200).optional()
    })
    .optional()
});

const updateUserSettingsSchema = z.object({
  notification_preferences: z
    .object({
      email_notifications: z.boolean().optional(),
      push_notifications: z.boolean().optional(),
      sms_notifications: z.boolean().optional()
    })
    .optional(),

  app_preferences: z
    .object({
      theme: z.enum(['light', 'dark', 'auto']).optional(),
      language: z.enum(['pt-BR', 'en-US', 'es-ES']).optional(),
      timezone: z.string().optional(),
      date_format: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']).optional()
    })
    .optional(),

  inspection_preferences: z
    .object({
      default_camera_quality: z.enum(['low', 'medium', 'high']).optional(),
      auto_backup_photos: z.boolean().optional(),
      offline_mode_enabled: z.boolean().optional()
    })
    .optional()
});

// ============================================================================
// ROTAS DE CONFIGURAÇÕES DA EMPRESA
// ============================================================================

/**
 * GET /api/v1/tenants/:tenant/settings/company
 * Obter configurações da empresa
 */
router.get(
  '/company',
  requireRole(['admin', 'manager']),
  asyncHandler(async (req, res) => {
    const { data: company, error } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', req.company.id)
      .single();

    if (error) {
      console.error('Erro ao buscar configurações da empresa', {
        error,
        company_id: req.company.id
      });
      throw error;
    }

    // Configurações padrão caso não existam
    const defaultSettings = {
      notification_settings: {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false,
        inspection_reminders: true,
        report_ready_notifications: true
      },
      inspection_settings: {
        auto_assign_inspectors: false,
        require_photos: true,
        min_photos_per_room: 3,
        allow_offline_inspections: true,
        inspection_timeout_hours: 24,
        quality_check_required: true
      },
      report_settings: {
        auto_generate_reports: true,
        include_photos_in_report: true,
        report_template: 'standard',
        watermark_reports: true,
        digital_signature_required: false
      },
      integration_settings: {
        webhook_url: '',
        webhook_events: [],
        api_rate_limit: 100
      },
      branding_settings: {
        company_logo_url: '',
        primary_color: '#2563eb',
        secondary_color: '#64748b',
        custom_footer_text: ''
      }
    };

    const settings = { ...defaultSettings, ...(company.settings || {}) };

    res.json({
      success: true,
      data: settings
    });
  })
);

/**
 * PUT /api/v1/tenants/:tenant/settings/company
 * Atualizar configurações da empresa
 */
router.put(
  '/company',
  requireRole(['admin']),
  validation(updateCompanySettingsSchema),
  asyncHandler(async (req, res) => {
    // Buscar configurações atuais
    const { data: currentCompany, error: fetchError } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', req.company.id)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar configurações atuais', {
        error: fetchError
      });
      throw fetchError;
    }

    // Merge das configurações
    const currentSettings = currentCompany.settings || {};
    const newSettings = {
      ...currentSettings,
      ...req.body,
      updated_at: new Date().toISOString(),
      updated_by: req.user.id
    };

    // Atualizar no banco
    const { data: company, error } = await supabase
      .from('companies')
      .update({ settings: newSettings })
      .eq('id', req.company.id)
      .select('settings')
      .single();

    if (error) {
      console.error('Erro ao atualizar configurações da empresa', {
        error,
        company_id: req.company.id
      });
      throw error;
    }

    console.log('Configurações da empresa atualizadas', {
      company_id: req.company.id,
      updated_by: req.user.id,
      changes: Object.keys(req.body)
    });

    res.json({
      success: true,
      data: company.settings,
      message: 'Configurações da empresa atualizadas com sucesso'
    });
  })
);

// ============================================================================
// ROTAS DE CONFIGURAÇÕES DO USUÁRIO
// ============================================================================

/**
 * GET /api/v1/tenants/:tenant/settings/user
 * Obter configurações do usuário
 */
router.get(
  '/user',
  asyncHandler(async (req, res) => {
    const { data: user, error } = await supabase
      .from('users')
      .select('settings')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('Erro ao buscar configurações do usuário', {
        error,
        user_id: req.user.id
      });
      throw error;
    }

    // Configurações padrão do usuário
    const defaultSettings = {
      notification_preferences: {
        email_notifications: true,
        push_notifications: true,
        sms_notifications: false
      },
      app_preferences: {
        theme: 'light',
        language: 'pt-BR',
        timezone: 'America/Sao_Paulo',
        date_format: 'DD/MM/YYYY'
      },
      inspection_preferences: {
        default_camera_quality: 'high',
        auto_backup_photos: true,
        offline_mode_enabled: true
      }
    };

    const settings = { ...defaultSettings, ...(user.settings || {}) };

    res.json({
      success: true,
      data: settings
    });
  })
);

/**
 * PUT /api/v1/tenants/:tenant/settings/user
 * Atualizar configurações do usuário
 */
router.put(
  '/user',
  validation(updateUserSettingsSchema),
  asyncHandler(async (req, res) => {
    // Buscar configurações atuais
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('settings')
      .eq('id', req.user.id)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar configurações atuais do usuário', {
        error: fetchError
      });
      throw fetchError;
    }

    // Merge das configurações
    const currentSettings = currentUser.settings || {};
    const newSettings = {
      ...currentSettings,
      ...req.body,
      updated_at: new Date().toISOString()
    };

    // Atualizar no banco
    const { data: user, error } = await supabase
      .from('users')
      .update({ settings: newSettings })
      .eq('id', req.user.id)
      .select('settings')
      .single();

    if (error) {
      console.error('Erro ao atualizar configurações do usuário', {
        error,
        user_id: req.user.id
      });
      throw error;
    }

    console.log('Configurações do usuário atualizadas', {
      user_id: req.user.id,
      changes: Object.keys(req.body)
    });

    res.json({
      success: true,
      data: user.settings,
      message: 'Configurações do usuário atualizadas com sucesso'
    });
  })
);

// ============================================================================
// ROTAS DE CONFIGURAÇÕES GLOBAIS (APENAS PARA REFERÊNCIA)
// ============================================================================

/**
 * GET /api/v1/tenants/:tenant/settings/app-info
 * Informações da aplicação (versão, recursos disponíveis, etc.)
 */
router.get(
  '/app-info',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        app_version: process.env.APP_VERSION || '1.0.0',
        api_version: process.env.API_VERSION || 'v1',
        environment: process.env.NODE_ENV || 'development',
        features: {
          offline_inspections: true,
          push_notifications: true,
          photo_compression: true,
          report_generation: true,
          multi_tenant: true,
          real_time_sync: true
        },
        limits: {
          max_photos_per_inspection: 50,
          max_file_size_mb: 10,
          max_inspections_per_day: 100,
          max_users_per_company: 50
        },
        supported_formats: {
          images: ['jpg', 'jpeg', 'png', 'webp'],
          reports: ['pdf'],
          exports: ['pdf', 'xlsx', 'csv']
        }
      }
    });
  })
);

module.exports = router;

