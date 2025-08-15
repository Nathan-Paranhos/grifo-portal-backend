import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SupabaseService, supabase } from '@/services/supabase';
import grifoApiService from '@/services/grifoApi';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();
    
    // Listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Auth state change logged for production
        
        if (event === 'SIGNED_IN' && session?.user) {
          setIsAuthenticated(true);
        } else if (event === 'SIGNED_OUT' || !session) {
          setIsAuthenticated(false);
          router.replace('/login');
        }
      }
    );
    
    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAuth = async () => {
    try {
      // Verificar primeiro a autenticação da API Grifo (sistema principal)
      if (grifoApiService.isAuthenticated()) {
        const userResponse = await grifoApiService.getCurrentUser();
        if (userResponse.success) {
          // User authenticated via API Grifo
          setIsAuthenticated(true);
          return;
        } else {
          // Token inválido, limpar e continuar verificação
          await grifoApiService.logout();
        }
      }
      
      // Fallback para Supabase (compatibilidade)
      const user = await SupabaseService.getCurrentUser();
      if (user) {
        // User authenticated via Supabase
        setIsAuthenticated(true);
      } else {
        // User not authenticated, redirecting to login
        setIsAuthenticated(false);
        router.replace('/login');
      }
    } catch (error) {
      // Auth check error handled silently
      setIsAuthenticated(false);
      router.replace('/login');
    }
  };

  if (isAuthenticated === null) {
    return <LoadingSpinner text="Verificando autenticação..." />;
  }

  if (!isAuthenticated) {
    return null; // Redirecionando para login
  }

  return <>{children}</>;
}

export default AuthGuard;