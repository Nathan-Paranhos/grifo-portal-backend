import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/services/supabase';
import { User } from '@supabase/supabase-js';
import { useMe } from '../hooks/useMe';
import { router } from 'expo-router';

interface AuthGateProps {
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

export default function AuthGate({ children }: AuthGateProps) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      setAuthReady(true);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const { data: me, error, isLoading } = useMe(authReady && !!user);

  // Aguardando inicialização do Supabase Auth
  if (!authReady) {
    return <LoadingSpinner label="Verificando autenticação..." />;
  }

  // Usuário não autenticado no Supabase
  if (!user) {
    // Redirecionar para login sem ficar preso no spinner
    useEffect(() => {
      router.replace('/login');
    }, []);
    return <LoadingSpinner label="Redirecionando..." />;
  }

  // Erro na verificação da sessão
  if (error) {
    console.warn('Erro na verificação de sessão:', error);
    // Redirecionar para login em caso de erro
    useEffect(() => {
      router.replace('/login');
    }, []);
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