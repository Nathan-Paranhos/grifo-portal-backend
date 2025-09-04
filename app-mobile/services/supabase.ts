import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Empresa, Imovel, Vistoria, DraftVistoria, SyncStats } from '@/types';
import grifoApiService from './grifoApi';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Validação das variáveis de ambiente
if (!supabaseUrl || !supabaseAnonKey) {
  // Supabase configuration error handled silently
  throw new Error('Supabase configuration is missing. Please check your .env file.');
}

// Cliente principal para operações do usuário
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export class SupabaseService {
  static async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao obter sessão:', error);
      throw error;
    }
  }

  static async getCurrentUser() {
    try {
      // Primeiro, tenta obter a sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        // Session error handled silently
        return null;
      }
      
      if (!session) {
        // No active session found
        return null;
      }
      
      // Se há sessão, obtém o usuário
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        // User error handled silently
        return null;
      }
      
      return user;
    } catch (error) {
      // getCurrentUser error handled silently
      return null;
    }
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Fallback já tratado acima
    throw new Error('Nenhuma fonte de dados disponível');
  }

  static async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    // Fallback - retornar dados vazios se não houver resposta da API Grifo
    return null;
  }

  static async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  static async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    
    // Fallback - retornar dados vazios se não houver resposta da API Grifo
    return null;
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  static async getImoveis(empresaId: string) {
    try {
      // Buscar da API Grifo
      const grifoResponse = await grifoApiService.getProperties();
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
      throw new Error('API Grifo não retornou dados válidos');
    } catch (error) {
      console.error('Erro ao buscar imóveis da API Grifo:', error);
      
      // Buscar diretamente do Supabase como alternativa
      const { data, error: supabaseError } = await supabase
        .from('imoveis')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('codigo');
      
      if (supabaseError) throw supabaseError;
      return data;
    }
  }

  static async createImovel(imovel: Partial<Imovel>) {
    try {
      // Criar na API Grifo
      const propertyData = {
         address: imovel.endereco || '',
         type: imovel.tipo || 'apartamento',
         cep: imovel.cep || '',
         city: imovel.cidade || '',
         state: imovel.estado || '',
         company_id: imovel.empresa_id || '',
         reference: imovel.codigo || ''
       };
      const grifoResponse = await grifoApiService.createProperty(propertyData);
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
      throw new Error('API Grifo não conseguiu criar o imóvel');
    } catch (error) {
      console.error('Erro ao criar imóvel na API Grifo:', error);
      
      // Criar diretamente no Supabase como alternativa
      const { data, error: supabaseError } = await supabase
        .from('imoveis')
        .insert(imovel)
        .select()
        .single();
      
      if (supabaseError) throw supabaseError;
      return data;
    }
  }

  static async updateImovel(id: string, updates: Partial<Imovel>) {
    try {
      // Atualizar na API Grifo
      const propertyUpdates = {
         address: updates.endereco,
         type: updates.tipo,
         cep: updates.cep || '',
         city: updates.cidade || '',
         state: updates.estado || '',
         company_id: updates.empresa_id,
         reference: updates.codigo
       };
      const grifoResponse = await grifoApiService.updateProperty(id, propertyUpdates);
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
      throw new Error('API Grifo não conseguiu atualizar o imóvel');
    } catch (error) {
      console.error('Erro ao atualizar imóvel na API Grifo:', error);
      
      // Atualizar diretamente no Supabase como alternativa
      const { data, error: supabaseError } = await supabase
        .from('imoveis')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (supabaseError) throw supabaseError;
      return data;
    }
  }

  static async getVistorias(empresaId: string) {
    try {
      // Buscar da API Grifo
      const grifoResponse = await grifoApiService.getInspections();
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
      throw new Error('API Grifo não retornou dados válidos');
    } catch (error) {
      console.error('Erro ao buscar vistorias da API Grifo:', error);
      
      // Buscar diretamente do Supabase como alternativa
      const { data, error: supabaseError } = await supabase
        .from('vistorias')
        .select(`
          *,
          imovel:imoveis(endereco, codigo, tipo),
          vistoriador:users(nome)
        `)
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false });
      
      if (supabaseError) throw supabaseError;
      return data;
    }
    
    // Fallback - retornar null se não houver resposta da API Grifo
    return null;
  }

  static async createVistoria(vistoria: Partial<Vistoria>) {
    try {
      // Criar na API Grifo
      const inspectionData = {
        property_id: vistoria.imovel_id || '',
        user_id: vistoria.vistoriador_id || '',
        status: vistoria.status || 'rascunho',
        data: vistoria
      };
      const grifoResponse = await grifoApiService.createInspection(inspectionData);
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
      throw new Error('API Grifo não conseguiu criar a vistoria');
    } catch (error) {
      console.error('Erro ao criar vistoria na API Grifo:', error);
      
      // Criar diretamente no Supabase como alternativa
      const { data, error: supabaseError } = await supabase
        .from('vistorias')
        .insert(vistoria)
        .select()
        .single();
      
      if (supabaseError) throw supabaseError;
      return data;
    }
  }

  static async updateVistoria(id: string, updates: Partial<Vistoria>) {
    try {
      // Atualizar na API Grifo
      const grifoResponse = await grifoApiService.updateInspection(id, updates);
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
      throw new Error('API Grifo não conseguiu atualizar a vistoria');
    } catch (error) {
      console.error('Erro ao atualizar vistoria na API Grifo:', error);
      
      // Atualizar diretamente no Supabase como alternativa
      const { data, error: supabaseError } = await supabase
        .from('vistorias')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (supabaseError) throw supabaseError;
      return data;
    }
  }

  static async uploadFile(bucket: string, path: string, file: Blob) {
    try {
      // Upload na API Grifo
      const grifoResponse = await grifoApiService.uploadFile(file, path);
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
      throw new Error('API Grifo não conseguiu fazer upload do arquivo');
    } catch (error) {
      console.error('Erro ao fazer upload na API Grifo:', error);
      
      // Upload diretamente no Supabase como alternativa
      const { data, error: supabaseError } = await supabase.storage
        .from(bucket)
        .upload(path, file);
      
      if (supabaseError) throw supabaseError;
      return data;
    }
  }

  // Upload otimizado de fotos (usar PhotoOptimizer para melhor performance)
  static async uploadOptimizedPhoto(uri: string, vistoriaId: string, ambiente: string, descricao?: string) {
    // Importação estática
    const { PhotoOptimizer } = require('./photoOptimizer');
    
    return await PhotoOptimizer.uploadOptimizedPhoto(uri, {
      vistoriaId,
      ambiente,
      descricao,
      generateThumbnail: true
    });
  }

  // Upload múltiplo otimizado
  static async uploadMultiplePhotos(
    photos: { uri: string; ambiente: string; descricao?: string }[],
    vistoriaId: string,
    onProgress?: (current: number, total: number) => void
  ) {
    const { PhotoOptimizer } = require('./photoOptimizer');
    
    return await PhotoOptimizer.uploadMultiplePhotos(photos, vistoriaId, onProgress);
  }

  // Obter estatísticas de fotos
  static async getPhotoStats(empresaId: string) {
    const { PhotoOptimizer } = require('./photoOptimizer');
    
    return await PhotoOptimizer.getPhotoStats(empresaId);
  }

  static async getSignedUrl(bucket: string, path: string, expiresIn = 3600) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn);
    
    if (error) throw error;
    return data.signedUrl;
  }

  // Dashboard KPIs usando RPC
  static async getDashboardKPIs(empresaId: string) {
    const { data, error } = await supabase
      .rpc('dashboard_kpis', { empresa: empresaId });
    
    if (error) throw error;
    return data;
  }

  // Estatísticas de uso
  static async getUsageStats(empresaId: string) {
    const { data, error } = await supabase
      .rpc('usage_stats', { empresa: empresaId });
    
    if (error) throw error;
    return data;
  }

  // Criar empresa (usando edge functions)
  static async createTenant(nome: string, cnpj: string) {
    const { data, error } = await supabase
      .functions
      .invoke('create_tenant', {
        body: { nome, cnpj }
      });
    
    if (error) throw error;
    return data;
  }

  // Atribuir role (usando edge functions)
  static async assignRole(userId: string, role: string, empresaId: string) {
    const { data, error } = await supabase
      .functions
      .invoke('assign_role', {
        body: { user_id: userId, role, empresa_id: empresaId }
      });
    
    if (error) throw error;
    return data;
  }

  // Finalizar vistoria
  static async finalizeVistoria(vistoriaId: string, pdfUrl: string) {
    try {
      // Atualizar vistoria com PDF
      const { data: vistoria, error: updateError } = await supabase
        .from('vistorias')
        .update({
          pdf_url: pdfUrl,
          status: 'finalizada',
          updated_at: new Date().toISOString()
        })
        .eq('id', vistoriaId)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      // Gerar link de contestação automaticamente
      try {
        const contestToken = await this.generateContestLink(vistoriaId, vistoria.empresa_id);
        console.log('Contest link generated:', contestToken);
      } catch (contestError) {
        console.warn('Failed to generate contest link (non-critical):', contestError);
      }
      
      // Chamar Edge Function se disponível
      try {
        const { data: edgeResult, error: edgeError } = await supabase
          .functions
          .invoke('finalize_vistoria', {
            body: { 
              vistoria_id: vistoriaId, 
              pdf_url: pdfUrl
            }
          });
        
        if (edgeError) {
          console.warn('Edge function error (non-critical):', edgeError);
        }
      } catch (edgeError) {
        console.warn('Edge function not available or failed:', edgeError);
      }
      
      return vistoria;
    } catch (error) {
      console.error('Error finalizing vistoria:', error);
      throw error;
    }
  }

  // Enviar vistoria para o portal
  static async sendVistoriaToPortal(vistoriaId: string, pdfUrl: string) {
    try {
      const portalUrl = process.env.EXPO_PUBLIC_PORTAL_URL;
      if (!portalUrl) {
        throw new Error('Portal URL not configured');
      }

      // Buscar dados completos da vistoria
      const { data: vistoria, error: vistoriaError } = await supabase
        .from('vistorias')
        .select(`
          *,
          imovel:imoveis(*),
          vistoriador:usuarios(*)
        `)
        .eq('id', vistoriaId)
        .single();

      if (vistoriaError) throw vistoriaError;

      // Preparar dados para envio ao portal
      const portalData = {
        vistoria_id: vistoriaId,
        pdf_url: pdfUrl,
        status: 'finalizada',
        tipo: vistoria.tipo,
        imovel: vistoria.imovel,
        vistoriador: vistoria.vistoriador,
        created_at: vistoria.created_at,
        updated_at: new Date().toISOString()
      };

      // Enviar para o portal via webhook/API
      const response = await fetch(`${portalUrl}/api/vistorias/receive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify(portalData)
      });

      if (!response.ok) {
        throw new Error(`Portal API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Vistoria sent to portal successfully:', result);
      
      return result;
    } catch (error) {
      console.error('Error sending vistoria to portal:', error);
      throw error;
    }
  }

  // Listar empresas (admin)
  static async getEmpresas() {
    try {
      // Tentar buscar da API Grifo primeiro
      const grifoResponse = await grifoApiService.getUsers();
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
    } catch (error) {
      console.warn('Grifo API not available, falling back to Supabase:', error);
    }

    // Fallback para Supabase
    const { data, error } = await supabase
      .from('empresas')
      .select('*')
      .order('nome');
    
    if (error) throw error;
    return data;
  }

  // Listar usuários por empresa
  static async getUsuarios(empresaId: string) {
    try {
      // Tentar buscar da API Grifo primeiro
      const grifoResponse = await grifoApiService.getUsers();
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data.filter((user: any) => user.empresa_id === empresaId);
      }
    } catch (error) {
      console.warn('Grifo API not available, falling back to Supabase:', error);
    }

    // Fallback para Supabase
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome');
    
    if (error) throw error;
    return data;
  }



  // Notificações
  static async getNotifications() {
    try {
      // Tentar buscar da API Grifo primeiro
      const grifoResponse = await grifoApiService.getNotifications();
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
    } catch (error) {
      console.warn('Grifo API not available, falling back to Supabase:', error);
    }

    // Fallback para Supabase (se houver tabela de notificações)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }

  static async markNotificationAsRead(notificationId: string) {
    try {
      // Tentar marcar como lida na API Grifo primeiro
      const grifoResponse = await grifoApiService.markNotificationAsRead(notificationId);
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
    } catch (error) {
      console.warn('Grifo API not available, falling back to Supabase:', error);
    }

    // Fallback para Supabase
    try {
      const { data, error } = await supabase
        .from('notifications')
        .update({ read: true, updated_at: new Date().toISOString() })
        .eq('id', notificationId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  }

  // Gerar link de contestação
  static async generateContestLink(vistoriaId: string, empresaId: string) {
    try {
      const { data, error } = await supabase
        .rpc('create_contest_link', {
          p_vistoria_id: vistoriaId,
          p_empresa_id: empresaId,
          p_expires_days: 30
        });
      
      if (error) throw error;
      return data; // Retorna o token gerado
    } catch (error) {
      console.error('Error generating contest link:', error);
      throw error;
    }
  }

  // Validar token de contestação
  static async validateContestToken(token: string) {
    try {
      const { data, error } = await supabase
        .rpc('validate_contest_token', {
          p_token: token
        });
      
      if (error) throw error;
      return data[0]; // Retorna o primeiro resultado da validação
    } catch (error) {
      console.error('Error validating contest token:', error);
      throw error;
    }
  }

  // Buscar dados da vistoria por token de contestação
  static async getVistoriaByContestToken(token: string) {
    try {
      // Primeiro validar o token
      const validation = await this.validateContestToken(token);
      
      if (!validation.is_valid) {
        throw new Error('Token inválido, expirado ou já utilizado');
      }

      // Buscar dados completos da vistoria
      const { data: vistoria, error } = await supabase
        .from('vistorias')
        .select(`
          *,
          imovel:imoveis(*),
          empresa:empresas(*)
        `)
        .eq('id', validation.vistoria_id)
        .single();
      
      if (error) throw error;
      
      return {
        vistoria,
        contest_link_id: validation.contest_link_id
      };
    } catch (error) {
      console.error('Error getting vistoria by contest token:', error);
      throw error;
    }
  }

  // Relatórios e Dashboard
  static async getReports() {
    try {
      // Tentar buscar da API Grifo primeiro
      const grifoResponse = await grifoApiService.getReports();
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
    } catch (error) {
      console.error('Erro ao buscar relatórios:', error);
      throw error;
    }

    // Fallback para dados locais/Supabase
    return {
      vistorias: await this.getVistorias(''),
      imoveis: await this.getImoveis(''),

    };
  }

  static async getDashboardData() {
    try {
      // Tentar buscar da API Grifo primeiro
      const grifoResponse = await grifoApiService.getDashboard();
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
    } catch (error) {
      console.warn('Grifo API not available, falling back to local calculations:', error);
    }

    // Fallback para cálculos locais
    try {
      const vistorias = await this.getVistorias('');
      const imoveis = await this.getImoveis('');
      
      return {
        totalVistorias: vistorias?.length || 0,
        totalImoveis: imoveis?.length || 0,
        vistoriasPendentes: Array.isArray(vistorias) ? vistorias.filter((v: any) => v.status === 'pendente').length : 0,
        vistoriasFinalizadas: Array.isArray(vistorias) ? vistorias.filter((v: any) => v.status === 'finalizada').length : 0
      };
    } catch {
      return {
        totalVistorias: 0,
        totalImoveis: 0,
        vistoriasPendentes: 0,
        vistoriasFinalizadas: 0
      };
    }
  }

  static async exportData() {
    try {
      // Tentar exportar da API Grifo primeiro
      const grifoResponse = await grifoApiService.exportData('all');
      if (grifoResponse && grifoResponse.success && grifoResponse.data) {
        return grifoResponse.data;
      }
    } catch (error) {
      console.warn('Grifo API not available, falling back to local export:', error);
    }

    // Fallback para exportação local
    const vistorias = await this.getVistorias('');
    const imoveis = await this.getImoveis('');
    
    return {
      vistorias: vistorias || [],
      imoveis: imoveis || [],
      exportedAt: new Date().toISOString()
    };
  }
}