import * as FileSystem from 'expo-file-system';
import { SupabaseService } from './supabase';

export interface SignatureData {
  id?: string;
  vistoria_id: string;
  tipo: 'vistoriador' | 'cliente' | 'testemunha';
  nome_assinante: string;
  cpf_assinante?: string;
  data_assinatura: string;
  assinatura_base64: string;
  hash_verificacao: string;
  ip_address?: string;
  user_agent?: string;
  coordenadas?: {
    latitude: number;
    longitude: number;
  };
}

export interface SignatureValidation {
  isValid: boolean;
  hash: string;
  timestamp: string;
  metadata: {
    width: number;
    height: number;
    pointCount: number;
  };
}

class SignatureServiceClass {
  private readonly SIGNATURE_DIR = `${FileSystem.documentDirectory}signatures/`;

  /**
   * Inicializa o serviço criando o diretório de assinaturas
   */
  async initialize(): Promise<void> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(this.SIGNATURE_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.SIGNATURE_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error('Erro ao inicializar SignatureService:', error);
      throw error;
    }
  }

  /**
   * Valida se uma assinatura é válida (não está vazia)
   */
  validateSignature(signatureBase64: string): SignatureValidation {
    try {
      // Remove o prefixo data:image/png;base64, se existir
      const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, '');
      
      // Verifica se não está vazio
      if (!base64Data || base64Data.length < 100) {
        return {
          isValid: false,
          hash: '',
          timestamp: new Date().toISOString(),
          metadata: { width: 0, height: 0, pointCount: 0 }
        };
      }

      // Gera hash para verificação de integridade
      const hash = this.generateSignatureHash(base64Data);
      
      // Estima metadados básicos (em uma implementação real, seria mais preciso)
      const metadata = {
        width: 400, // Largura padrão do canvas
        height: 200, // Altura padrão do canvas
        pointCount: Math.floor(base64Data.length / 100) // Estimativa de pontos
      };

      return {
        isValid: true,
        hash,
        timestamp: new Date().toISOString(),
        metadata
      };
    } catch (error) {
      console.error('Erro ao validar assinatura:', error);
      return {
        isValid: false,
        hash: '',
        timestamp: new Date().toISOString(),
        metadata: { width: 0, height: 0, pointCount: 0 }
      };
    }
  }

  /**
   * Gera um hash simples para verificação de integridade
   */
  private generateSignatureHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Salva uma assinatura localmente
   */
  async saveSignatureLocally(signatureData: SignatureData): Promise<string> {
    try {
      await this.initialize();
      
      const filename = `signature_${signatureData.vistoria_id}_${signatureData.tipo}_${Date.now()}.json`;
      const filepath = `${this.SIGNATURE_DIR}${filename}`;
      
      await FileSystem.writeAsStringAsync(filepath, JSON.stringify(signatureData));
      
      return filepath;
    } catch (error) {
      console.error('Erro ao salvar assinatura localmente:', error);
      throw error;
    }
  }

  /**
   * Salva uma assinatura no Supabase
   */
  async saveSignatureToSupabase(signatureData: SignatureData): Promise<string> {
    try {
      const { data, error } = await SupabaseService.client
        .from('assinaturas_digitais')
        .insert({
          vistoria_id: signatureData.vistoria_id,
          tipo: signatureData.tipo,
          nome_assinante: signatureData.nome_assinante,
          cpf_assinante: signatureData.cpf_assinante,
          data_assinatura: signatureData.data_assinatura,
          assinatura_base64: signatureData.assinatura_base64,
          hash_verificacao: signatureData.hash_verificacao,
          ip_address: signatureData.ip_address,
          user_agent: signatureData.user_agent,
          coordenadas: signatureData.coordenadas
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    } catch (error) {
      console.error('Erro ao salvar assinatura no Supabase:', error);
      throw error;
    }
  }

  /**
   * Carrega assinaturas de uma vistoria
   */
  async getSignaturesByVistoria(vistoriaId: string): Promise<SignatureData[]> {
    try {
      const { data, error } = await SupabaseService.client
        .from('assinaturas_digitais')
        .select('*')
        .eq('vistoria_id', vistoriaId)
        .order('data_assinatura', { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao carregar assinaturas:', error);
      throw error;
    }
  }

  /**
   * Remove uma assinatura
   */
  async deleteSignature(signatureId: string): Promise<void> {
    try {
      const { error } = await SupabaseService.client
        .from('assinaturas_digitais')
        .delete()
        .eq('id', signatureId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Erro ao deletar assinatura:', error);
      throw error;
    }
  }

  /**
   * Carrega assinaturas locais (modo offline)
   */
  async getLocalSignatures(): Promise<SignatureData[]> {
    try {
      await this.initialize();
      
      const files = await FileSystem.readDirectoryAsync(this.SIGNATURE_DIR);
      const signatures: SignatureData[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filepath = `${this.SIGNATURE_DIR}${file}`;
            const content = await FileSystem.readAsStringAsync(filepath);
            const signature = JSON.parse(content) as SignatureData;
            signatures.push(signature);
          } catch (error) {
            console.warn(`Erro ao ler arquivo de assinatura ${file}:`, error);
          }
        }
      }
      
      return signatures.sort((a, b) => 
        new Date(a.data_assinatura).getTime() - new Date(b.data_assinatura).getTime()
      );
    } catch (error) {
      console.error('Erro ao carregar assinaturas locais:', error);
      return [];
    }
  }

  /**
   * Sincroniza assinaturas locais com o servidor
   */
  async syncLocalSignatures(): Promise<{ synced: number; errors: number }> {
    try {
      const localSignatures = await this.getLocalSignatures();
      let synced = 0;
      let errors = 0;
      
      for (const signature of localSignatures) {
        try {
          // Verifica se já existe no servidor
          const { data: existing } = await SupabaseService.client
            .from('assinaturas_digitais')
            .select('id')
            .eq('vistoria_id', signature.vistoria_id)
            .eq('tipo', signature.tipo)
            .eq('hash_verificacao', signature.hash_verificacao)
            .single();
          
          if (!existing) {
            await this.saveSignatureToSupabase(signature);
            synced++;
          }
        } catch (error) {
          console.warn('Erro ao sincronizar assinatura:', error);
          errors++;
        }
      }
      
      return { synced, errors };
    } catch (error) {
      console.error('Erro ao sincronizar assinaturas:', error);
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Limpa assinaturas locais antigas (mais de 30 dias)
   */
  async cleanupOldSignatures(): Promise<number> {
    try {
      await this.initialize();
      
      const files = await FileSystem.readDirectoryAsync(this.SIGNATURE_DIR);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      let cleaned = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filepath = `${this.SIGNATURE_DIR}${file}`;
            const fileInfo = await FileSystem.getInfoAsync(filepath);
            
            if (fileInfo.exists && fileInfo.modificationTime) {
              const fileDate = new Date(fileInfo.modificationTime * 1000);
              
              if (fileDate < thirtyDaysAgo) {
                await FileSystem.deleteAsync(filepath);
                cleaned++;
              }
            }
          } catch (error) {
            console.warn(`Erro ao limpar arquivo ${file}:`, error);
          }
        }
      }
      
      return cleaned;
    } catch (error) {
      console.error('Erro ao limpar assinaturas antigas:', error);
      return 0;
    }
  }

  /**
   * Converte assinatura para formato de imagem
   */
  async saveSignatureAsImage(signatureBase64: string, filename: string): Promise<string> {
    try {
      await this.initialize();
      
      const imageDir = `${this.SIGNATURE_DIR}images/`;
      const dirInfo = await FileSystem.getInfoAsync(imageDir);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });
      }
      
      const filepath = `${imageDir}${filename}.png`;
      
      // Remove o prefixo se existir
      const base64Data = signatureBase64.replace(/^data:image\/png;base64,/, '');
      
      await FileSystem.writeAsStringAsync(filepath, base64Data, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      return filepath;
    } catch (error) {
      console.error('Erro ao salvar imagem da assinatura:', error);
      throw error;
    }
  }
}

export const SignatureService = new SignatureServiceClass();