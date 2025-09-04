import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/services/supabase';
import { User } from '@supabase/supabase-js';
import { useMe } from '../hooks/useMe';
import { router } from 'expo-router';

// Verificar se está em modo de demonstração
const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

interface AuthGuardProps {
  children: React.ReactNode;
}

const LoadingSpinner = ({ label }: { label: string }) => (
  <View style={styles.container}>
    <ActivityIndicator size="large" color="#0066cc" />
    <Text style={styles.loadingText}>{label}</Text>
  </View>
);

const ErrorBox = ({ msg }: { msg: string }) => (
  <View style={styles.container}>
    <Text style={styles.errorText}>{msg}</Text>
  </View>
);

export function AuthGuard({ children }: AuthGuardProps) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);

  // Se estiver em modo demo, pular toda a autenticação
  if (DEMO_MODE) {
    return <>{children}</>;
  }

  // Todos os hooks devem estar no topo do componente
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const { data: me, error, isLoading } = useMe(authReady && !!user);

  // Hook para controlar redirecionamento
  useEffect(() => {
    if (shouldRedirectToLogin) {
      router.replace('/login');
    }
  }, [shouldRedirectToLogin]);

  // Hook para detectar quando deve redirecionar
  useEffect(() => {
    if (authReady && !user) {
      setShouldRedirectToLogin(true);
    }
  }, [authReady, user]);

  // Hook para detectar erro e redirecionar
  useEffect(() => {
    if (error) {
      console.warn('Erro na verificação de sessão:', error);
      setShouldRedirectToLogin(true);
    }
  }, [error]);

  // Aguardando inicialização do Supabase Auth
  if (!authReady) {
    return <LoadingSpinner label="Verificando autenticação..." />;
  }

  // Usuário não autenticado no Supabase
  if (!user) {
    return <LoadingSpinner label="Redirecionando..." />;
  }

  // Erro na verificação da sessão
  if (error) {
    return <ErrorBox msg="Sessão inválida. Redirecionando..." />;
  }

  // Carregando dados do usuário
  if (isLoading || !me) {
    return <LoadingSpinner label="Carregando dados..." />;
  }

  // Usuário autenticado e dados carregados
  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default AuthGuard;