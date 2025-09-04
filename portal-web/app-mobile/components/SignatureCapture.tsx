import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  TextInput,
  ScrollView,
  Dimensions
} from 'react-native';
import SignatureScreen from 'react-native-signature-canvas';
import { useSignature } from '@/hooks/useSignature';
import { SignatureData } from '@/services/signatureService';
import { Card } from '@/components/ui/Card';
import { colors, typography, spacing } from '@/constants/colors';
import {
  PenTool,
  X,
  Check,
  RotateCcw,
  User,
  FileText,
  AlertCircle
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface SignatureCaptureProps {
  vistoriaId: string;
  tipo: 'vistoriador' | 'cliente' | 'testemunha';
  onSignatureSaved?: (signatureId: string) => void;
  onCancel?: () => void;
  visible: boolean;
  defaultName?: string;
  defaultCpf?: string;
}

export function SignatureCapture({
  vistoriaId,
  tipo,
  onSignatureSaved,
  onCancel,
  visible,
  defaultName = '',
  defaultCpf = ''
}: SignatureCaptureProps) {
  const { saveSignature, validateSignature, isLoading, error, clearError } = useSignature();
  const signatureRef = useRef<any>(null);
  
  const [signatureBase64, setSignatureBase64] = useState<string>('');
  const [nomeAssinante, setNomeAssinante] = useState(defaultName);
  const [cpfAssinante, setCpfAssinante] = useState(defaultCpf);
  const [hasSignature, setHasSignature] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Configurações do canvas de assinatura
  const signatureStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: 2px dashed #e0e0e0;
      border-radius: 8px;
      background-color: #ffffff;
    }
    .m-signature-pad--body {
      border: none;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
    }
  `;

  const handleSignatureEnd = useCallback(() => {
    if (signatureRef.current) {
      signatureRef.current.readSignature();
    }
  }, []);

  const handleSignatureOK = useCallback((signature: string) => {
    setSignatureBase64(signature);
    setHasSignature(true);
    
    // Valida a assinatura
    const validation = validateSignature(signature);
    if (!validation.isValid) {
      Alert.alert('Atenção', 'A assinatura parece estar vazia. Por favor, assine novamente.');
      setHasSignature(false);
      return;
    }
    
    setShowForm(true);
  }, [validateSignature]);

  const handleSignatureEmpty = useCallback(() => {
    setHasSignature(false);
    setSignatureBase64('');
  }, []);

  const handleClearSignature = useCallback(() => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
    setSignatureBase64('');
    setHasSignature(false);
    setShowForm(false);
  }, []);

  const handleSaveSignature = useCallback(async () => {
    if (!nomeAssinante.trim()) {
      Alert.alert('Erro', 'Por favor, informe o nome do assinante.');
      return;
    }

    if (!signatureBase64) {
      Alert.alert('Erro', 'Por favor, capture a assinatura primeiro.');
      return;
    }

    try {
      clearError();
      
      const signatureData: Omit<SignatureData, 'id' | 'data_assinatura' | 'hash_verificacao'> = {
        vistoria_id: vistoriaId,
        tipo,
        nome_assinante: nomeAssinante.trim(),
        cpf_assinante: cpfAssinante.trim() || undefined,
        assinatura_base64: signatureBase64,
        ip_address: undefined, // Seria obtido do servidor
        user_agent: 'Grifo Mobile App',
        coordenadas: undefined // Poderia ser integrado com geolocalização
      };

      const signatureId = await saveSignature(signatureData);
      
      if (signatureId) {
        Alert.alert(
          'Sucesso',
          'Assinatura salva com sucesso!',
          [
            {
              text: 'OK',
              onPress: () => {
                onSignatureSaved?.(signatureId);
                handleClose();
              }
            }
          ]
        );
      }
    } catch (err) {
      console.error('Erro ao salvar assinatura:', err);
      Alert.alert('Erro', 'Não foi possível salvar a assinatura. Tente novamente.');
    }
  }, [nomeAssinante, cpfAssinante, signatureBase64, vistoriaId, tipo, saveSignature, clearError, onSignatureSaved]);

  const handleClose = useCallback(() => {
    setSignatureBase64('');
    setNomeAssinante(defaultName);
    setCpfAssinante(defaultCpf);
    setHasSignature(false);
    setShowForm(false);
    clearError();
    onCancel?.();
  }, [defaultName, defaultCpf, clearError, onCancel]);

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const handleCpfChange = (text: string) => {
    const formatted = formatCpf(text);
    if (formatted.length <= 14) {
      setCpfAssinante(formatted);
    }
  };

  const getTipoLabel = () => {
    switch (tipo) {
      case 'vistoriador':
        return 'Vistoriador';
      case 'cliente':
        return 'Cliente';
      case 'testemunha':
        return 'Testemunha';
      default:
        return 'Assinante';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <PenTool size={24} color={colors.primary} />
            <Text style={styles.headerTitle}>Assinatura Digital</Text>
          </View>
          
          <View style={styles.headerRight} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Tipo de Assinatura */}
          <Card style={styles.typeCard}>
            <View style={styles.typeHeader}>
              <User size={20} color={colors.primary} />
              <Text style={styles.typeTitle}>Tipo de Assinatura</Text>
            </View>
            <Text style={styles.typeValue}>{getTipoLabel()}</Text>
          </Card>

          {/* Canvas de Assinatura */}
          <Card style={styles.signatureCard}>
            <Text style={styles.sectionTitle}>Assinatura</Text>
            <Text style={styles.sectionSubtitle}>
              Assine no espaço abaixo usando o dedo ou stylus
            </Text>
            
            <View style={styles.signatureContainer}>
              <SignatureScreen
                ref={signatureRef}
                onEnd={handleSignatureEnd}
                onOK={handleSignatureOK}
                onEmpty={handleSignatureEmpty}
                onClear={handleSignatureEmpty}
                autoClear={false}
                descriptionText=""
                clearText="Limpar"
                confirmText="Confirmar"
                webStyle={signatureStyle}
                style={styles.signatureCanvas}
              />
            </View>
            
            {/* Botões de Ação da Assinatura */}
            <View style={styles.signatureActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.clearButton]}
                onPress={handleClearSignature}
              >
                <RotateCcw size={18} color={colors.textSecondary} />
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>
              
              {hasSignature && (
                <View style={styles.signatureStatus}>
                  <Check size={18} color={colors.success} />
                  <Text style={styles.signatureStatusText}>Assinatura capturada</Text>
                </View>
              )}
            </View>
          </Card>

          {/* Formulário de Dados */}
          {showForm && (
            <Card style={styles.formCard}>
              <View style={styles.formHeader}>
                <FileText size={20} color={colors.primary} />
                <Text style={styles.sectionTitle}>Dados do Assinante</Text>
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nome Completo *</Text>
                <TextInput
                  style={styles.input}
                  value={nomeAssinante}
                  onChangeText={setNomeAssinante}
                  placeholder="Digite o nome completo"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>CPF (opcional)</Text>
                <TextInput
                  style={styles.input}
                  value={cpfAssinante}
                  onChangeText={handleCpfChange}
                  placeholder="000.000.000-00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={14}
                />
              </View>
            </Card>
          )}

          {/* Erro */}
          {error && (
            <Card style={[styles.errorCard]}>
              <View style={styles.errorContent}>
                <AlertCircle size={20} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </Card>
          )}
        </ScrollView>

        {/* Footer */}
        {showForm && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerButton, styles.cancelButton]}
              onPress={handleClose}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.footerButton, styles.saveButton, isLoading && styles.disabledButton]}
              onPress={handleSaveSignature}
              disabled={isLoading || !hasSignature || !nomeAssinante.trim()}
            >
              <Text style={styles.saveButtonText}>
                {isLoading ? 'Salvando...' : 'Salvar Assinatura'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeButton: {
    padding: spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  headerRight: {
    width: 40, // Para balancear o layout
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  typeCard: {
    marginBottom: spacing.lg,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  typeTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  typeValue: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    marginLeft: spacing.lg + spacing.sm,
  },
  signatureCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  signatureContainer: {
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  signatureCanvas: {
    flex: 1,
  },
  signatureActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  clearButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  signatureStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  signatureStatusText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.success,
  },
  formCard: {
    marginBottom: spacing.lg,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  errorCard: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger,
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.danger,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.white,
  },
  disabledButton: {
    opacity: 0.6,
  },
});