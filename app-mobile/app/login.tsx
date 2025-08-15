import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { SupabaseService } from '@/services/supabase';
import grifoApiService from '@/services/grifoApi';
import { ModernCard } from '@/components/ui/ModernCard';
import { ModernButton } from '@/components/ui/ModernButton';
import { ModernInput } from '@/components/ui/ModernInput';
import { ModernLoadingSpinner } from '@/components/ui/ModernLoadingSpinner';
import { ModernToast } from '@/components/ui/ModernToast';
import { useToast } from '@/hooks/useToast';
import { colors, typography, spacing } from '@/constants/colors';
import { Mail, Lock, Eye, EyeOff, User, Phone } from 'lucide-react-native';

interface LoginScreenProps {
  skipAuthCheck?: boolean;
}

export default function LoginScreen({ skipAuthCheck = false }: LoginScreenProps = {}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!skipAuthCheck);
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    if (!skipAuthCheck) {
      checkAuthStatus();
    }
  }, [skipAuthCheck]);

  const checkAuthStatus = async () => {
    try {
      // Verificar se há token da API Grifo
      if (grifoApiService.isAuthenticated()) {
        // Verificar se o token ainda é válido
        const userResponse = await grifoApiService.getCurrentUser();
        if (userResponse.success) {
          // User already authenticated
          router.replace('/(tabs)');
          return;
        } else {
          // Token inválido, limpar e continuar na tela de login
          await grifoApiService.logout();
        }
      }
      
      // Fallback para Supabase (compatibilidade)
      const user = await SupabaseService.getCurrentUser();
      if (user) {
        router.replace('/(tabs)');
      }
    } catch (error) {
      // Auth check error handled silently
      // Em caso de erro, limpar autenticação
      await grifoApiService.logout();
    } finally {
      setInitialLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    // Validação de entrada
    if (!email?.trim()) {
      showError('Por favor, digite seu e-mail');
      return;
    }

    if (!password?.trim()) {
      showError('Por favor, digite sua senha');
      return;
    }

    // Validação básica de e-mail
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Por favor, digite um e-mail válido');
      return;
    }

    if (password.length < 6) {
      showError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (isSignUp) {
      if (!name?.trim()) {
        showError('Por favor, digite seu nome');
        return;
      }

      if (name.trim().length < 2) {
        showError('O nome deve ter pelo menos 2 caracteres');
        return;
      }
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Registrar na API Grifo
        const response = await grifoApiService.register({
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          phone: phone?.trim() || undefined,
        });

        if (response.success) {
          showSuccess('Conta criada com sucesso!');
          setTimeout(() => {
            setIsSignUp(false);
            setName('');
            setPhone('');
            setPassword(''); // Limpar senha por segurança
          }, 1500);
        } else {
          showError(response.error || 'Erro ao criar conta');
        }
      } else {
        // Login na API Grifo
        const response = await grifoApiService.login(email.trim().toLowerCase(), password);
        
        if (response.success) {
          // Verificar se o usuário foi autenticado corretamente
          const userResponse = await grifoApiService.getCurrentUser();
          if (userResponse.success) {
            showSuccess('Login realizado com sucesso!');
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 1000);
          } else {
            showError('Falha na verificação do usuário');
          }
        } else {
          showError(response.error || 'Credenciais inválidas');
        }
      }
    } catch (error: any) {
      // Auth error handled silently
      showError('Erro de conexão. Verifique sua internet.');
    } finally {
      setLoading(false);
    }
  };



  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Erro', 'Por favor, digite seu email primeiro');
      return;
    }

    try {
      await SupabaseService.resetPassword(email);
      Alert.alert(
        'Email enviado!',
        'Verifique sua caixa de entrada para redefinir sua senha.'
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message || 'Ocorreu um erro ao enviar o email de recuperação'
      );
    }
  };

  if (initialLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ModernLoadingSpinner 
          variant="gradient" 
          size="large" 
          text="Verificando autenticação..." 
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Logo/Header */}
          <ModernCard style={styles.header} variant="elevated" padding="xl">
            <Text style={styles.title}>Grifo App</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? 'Criar nova conta' : 'Faça login para continuar'}
            </Text>
          </ModernCard>

          {/* Login Form */}
          <ModernCard style={styles.formCard} variant="elevated">
            <View style={styles.form}>
              {isSignUp && (
                <ModernInput
                  label="Nome completo"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoComplete="name"
                  leftIcon={<User size={20} color={colors.accent} />}
                  variant="filled"
                />
              )}

              {isSignUp && (
                <ModernInput
                  label="Telefone (opcional)"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  leftIcon={<Phone size={20} color={colors.accent} />}
                  variant="filled"
                />
              )}

              <ModernInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                leftIcon={<Mail size={20} color={colors.accent} />}
                variant="filled"
              />

              <ModernInput
                label="Senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                leftIcon={<Lock size={20} color={colors.accent} />}
                rightIcon={
                  showPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )
                }
                onRightIconPress={() => setShowPassword(!showPassword)}
                variant="filled"
              />

              {!isSignUp && (
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotPassword}>Esqueceu a senha?</Text>
                </TouchableOpacity>
              )}

              <ModernButton
                title={isSignUp ? 'Criar Conta' : 'Entrar'}
                onPress={handleEmailAuth}
                loading={loading}
                variant="primary"
                size="lg"
                style={styles.loginButton}
              />

              <TouchableOpacity
                onPress={() => setIsSignUp(!isSignUp)}
                style={styles.switchMode}
              >
                <Text style={styles.switchModeText}>
                  {isSignUp ? 'Já tem uma conta? ' : 'Não tem uma conta? '}
                  <Text style={styles.switchModeLink}>
                    {isSignUp ? 'Fazer login' : 'Criar conta'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ModernCard>
        </View>
      </KeyboardAvoidingView>
      
      <ModernToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={toast.duration}
        position={toast.position}
        onHide={hideToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.size.huge,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    marginTop: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },

  forgotPassword: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    textAlign: 'right',
    marginTop: -spacing.sm,
  },
  loginButton: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  switchModeText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  switchModeLink: {
    color: colors.primary,
    fontFamily: typography.fontFamily.medium,
  },
});