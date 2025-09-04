import useSWR from 'swr';
import { api } from '../lib/api';

// Fetcher para SWR
const fetcher = (url: string) => api.get(url).then(r => r.data);

/**
 * Hook para verificação de sessão sem loop
 * @param authReady - Se a autenticação Supabase está pronta
 * @returns Dados do usuário, loading e error states
 */
export function useMe(authReady: boolean) {
  return useSWR(
    authReady ? '/api/v1/auth/me' : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      dedupingInterval: 30_000, // 30 segundos
      errorRetryCount: 0, // não tentar novamente em caso de erro
      refreshInterval: 0, // não fazer polling automático
      revalidateOnReconnect: false,
    }
  );
}