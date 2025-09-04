import { useState, useCallback, useEffect } from 'react';
import { SignatureService, SignatureData, SignatureValidation } from '@/services/signatureService';
import NetInfo from '@react-native-community/netinfo';

export interface UseSignatureReturn {
  // Estados
  signatures: SignatureData[];
  isLoading: boolean;
  error: string | null;
  isOnline: boolean;
  
  // Funções
  validateSignature: (signatureBase64: string) => SignatureValidation;
  saveSignature: (signatureData: Omit<SignatureData, 'id' | 'data_assinatura' | 'hash_verificacao'>) => Promise<string | null>;
  loadSignatures: (vistoriaId: string) => Promise<void>;
  deleteSignature: (signatureId: string) => Promise<void>;
  syncSignatures: () => Promise<{ synced: number; errors: number }>;
  clearError: () => void;
  refreshSignatures: (vistoriaId: string) => Promise<void>;
}

export function useSignature(): UseSignatureReturn {
  const [signatures, setSignatures] = useState<SignatureData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  // Monitora status da rede
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected || false);
    });

    // Verifica status inicial
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected || false);
    });

    return () => unsubscribe();
  }, []);

  /**
   * Valida uma assinatura
   */
  const validateSignature = useCallback((signatureBase64: string): SignatureValidation => {
    try {
      return SignatureService.validateSignature(signatureBase64);
    } catch (err) {
      console.error('Erro ao validar assinatura:', err);
      return {
        isValid: false,
        hash: '',
        timestamp: new Date().toISOString(),
        metadata: { width: 0, height: 0, pointCount: 0 }
      };
    }
  }, []);

  /**
   * Salva uma assinatura
   */
  const saveSignature = useCallback(async (
    signatureData: Omit<SignatureData, 'id' | 'data_assinatura' | 'hash_verificacao'>
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      // Valida a assinatura
      const validation = validateSignature(signatureData.assinatura_base64);
      
      if (!validation.isValid) {
        throw new Error('Assinatura inválida ou vazia');
      }

      // Prepara os dados completos
      const completeSignatureData: SignatureData = {
        ...signatureData,
        data_assinatura: new Date().toISOString(),
        hash_verificacao: validation.hash
      };

      let signatureId: string;

      if (isOnline) {
        try {
          // Tenta salvar no servidor primeiro
          signatureId = await SignatureService.saveSignatureToSupabase(completeSignatureData);
          
          // Salva localmente como backup
          await SignatureService.saveSignatureLocally({
            ...completeSignatureData,
            id: signatureId
          });
        } catch (serverError) {
          console.warn('Erro ao salvar no servidor, salvando localmente:', serverError);
          
          // Se falhar no servidor, salva apenas localmente
          await SignatureService.saveSignatureLocally(completeSignatureData);
          signatureId = `local_${Date.now()}`;
        }
      } else {
        // Modo offline - salva apenas localmente
        await SignatureService.saveSignatureLocally(completeSignatureData);
        signatureId = `local_${Date.now()}`;
      }

      return signatureId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar assinatura';
      setError(errorMessage);
      console.error('Erro ao salvar assinatura:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, validateSignature]);

  /**
   * Carrega assinaturas de uma vistoria
   */
  const loadSignatures = useCallback(async (vistoriaId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      let loadedSignatures: SignatureData[] = [];

      if (isOnline) {
        try {
          // Tenta carregar do servidor
          loadedSignatures = await SignatureService.getSignaturesByVistoria(vistoriaId);
        } catch (serverError) {
          console.warn('Erro ao carregar do servidor, carregando localmente:', serverError);
          
          // Se falhar, carrega localmente
          const localSignatures = await SignatureService.getLocalSignatures();
          loadedSignatures = localSignatures.filter(sig => sig.vistoria_id === vistoriaId);
        }
      } else {
        // Modo offline - carrega apenas localmente
        const localSignatures = await SignatureService.getLocalSignatures();
        loadedSignatures = localSignatures.filter(sig => sig.vistoria_id === vistoriaId);
      }

      setSignatures(loadedSignatures);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar assinaturas';
      setError(errorMessage);
      console.error('Erro ao carregar assinaturas:', err);
      setSignatures([]);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  /**
   * Remove uma assinatura
   */
  const deleteSignature = useCallback(async (signatureId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      if (isOnline && !signatureId.startsWith('local_')) {
        await SignatureService.deleteSignature(signatureId);
      }

      // Remove da lista local
      setSignatures(prev => prev.filter(sig => sig.id !== signatureId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar assinatura';
      setError(errorMessage);
      console.error('Erro ao deletar assinatura:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  /**
   * Sincroniza assinaturas locais com o servidor
   */
  const syncSignatures = useCallback(async (): Promise<{ synced: number; errors: number }> => {
    if (!isOnline) {
      return { synced: 0, errors: 0 };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await SignatureService.syncLocalSignatures();
      
      if (result.errors > 0) {
        setError(`Sincronização parcial: ${result.synced} sincronizadas, ${result.errors} erros`);
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao sincronizar assinaturas';
      setError(errorMessage);
      console.error('Erro ao sincronizar assinaturas:', err);
      return { synced: 0, errors: 1 };
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  /**
   * Atualiza a lista de assinaturas
   */
  const refreshSignatures = useCallback(async (vistoriaId: string): Promise<void> => {
    await loadSignatures(vistoriaId);
  }, [loadSignatures]);

  /**
   * Limpa erros
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    signatures,
    isLoading,
    error,
    isOnline,
    validateSignature,
    saveSignature,
    loadSignatures,
    deleteSignature,
    syncSignatures,
    clearError,
    refreshSignatures
  };
}