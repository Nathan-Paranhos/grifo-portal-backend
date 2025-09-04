import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { SupabaseService } from '@/services/supabase';
import { OfflineService } from '@/services/offline';
import { PdfService } from '@/services/pdf';
import { SyncService } from '@/services/sync';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { colors, typography, spacing } from '@/constants/colors';
import { DraftVistoria, DraftAmbiente, Imovel } from '@/types';
import { ArrowLeft, Chrome as Home, Camera, FileText, CircleCheck as CheckCircle, CameraIcon } from 'lucide-react-native';

const WIZARD_STEPS = [
  { id: 'info', title: 'Informações Gerais', icon: Home },
  { id: 'ambientes', title: 'Ambientes', icon: Camera },
  { id: 'revisao', title: 'Revisão', icon: FileText },
  { id: 'finalizar', title: 'Finalizar', icon: CheckCircle },
];

const AMBIENTES_PREDEFINIDOS = [
  'Sala de Estar', 'Cozinha', 'Quarto 1', 'Quarto 2', 'Quarto 3',
  'Banheiro 1', 'Banheiro 2', 'Área de Serviço', 'Varanda', 'Garagem'
];

export default function WizardScreen() {
  useLocalSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  
  // Draft data
  const [draftVistoria, setDraftVistoria] = useState<DraftVistoria>({
    id: `draft_${Date.now()}`,
    empresa_id: '', // Will be set from authenticated user
    imovel_id: '',
    tipo: 'entrada',
    ambientes: [],
    synced: false,
    created_at: new Date().toISOString(),
  });

  const [selectedAmbiente, setSelectedAmbiente] = useState<string>('');
  const [comentarioAmbiente, setComentarioAmbiente] = useState<string>('');
  const [observacoesGerais, setObservacoesGerais] = useState<string>('');
  const [finalizando, setFinalizando] = useState<boolean>(false);

  useEffect(() => {
    loadImoveis();
  }, []);

  const loadImoveis = async () => {
    try {
      // Verificar se há usuário autenticado
      const currentUser = await SupabaseService.getCurrentUser();
      
      if (!currentUser) {
        // No authenticated user found
        setImoveis([]);
        return;
      }
      
      // Usar empresa_id do usuário autenticado
      const empresaId = currentUser.user_metadata?.empresa_id;
      
      if (!empresaId) {
        // User has no empresa_id
        setImoveis([]);
        return;
      }
      
      // Atualizar empresa_id no draft
      setDraftVistoria(prev => ({ ...prev, empresa_id: empresaId }));
      
      const data = await SupabaseService.getImoveis(empresaId);
      setImoveis(Array.isArray(data) ? data : []);
    } catch (error) {
        // Error loading imoveis handled silently
        setImoveis([]);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      router.back();
    }
  };

  const handleNext = async () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await handleFinalize();
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      // Atualizar draft com observações gerais
      const vistoriaFinalizada = {
        ...draftVistoria,
        observacoes: observacoesGerais,
        status: 'synced' as const,
        finalized_at: new Date().toISOString(),
      };
      
      // Save draft locally
      await OfflineService.saveDraftVistoria(vistoriaFinalizada);
      
      // Generate PDF
      const selectedImovel = imoveis.find(i => i.id === draftVistoria.imovel_id);
      if (selectedImovel) {
        const pdfPath = await PdfService.generatePdf(vistoriaFinalizada, selectedImovel);
        
        // Queue PDF for upload
        await SyncService.queuePdfUpload(
          vistoriaFinalizada.id,
          pdfPath,
          `vistoria_${vistoriaFinalizada.id}.pdf`
        );
      }

      // Get current user for vistoriador_id
      const currentUser = await SupabaseService.getCurrentUser();
      const vistoriadorId = currentUser?.id || 'unknown';

      // Create vistoria record in Supabase
      await SupabaseService.createVistoria({
        empresa_id: vistoriaFinalizada.empresa_id,
        imovel_id: vistoriaFinalizada.imovel_id,
        vistoriador_id: vistoriadorId,
        tipo: vistoriaFinalizada.tipo,
        status: 'finalizada',
        observacoes: observacoesGerais,
      });

      // Atualizar o estado local
      setDraftVistoria(vistoriaFinalizada);
      setFinalizando(true);
      
      // Não mostrar alert, apenas continuar o fluxo
      // O usuário verá a tela de sucesso
    } catch (error) {
        // Error finalizing vistoria handled silently
        Alert.alert('Erro', 'Não foi possível finalizar a vistoria');
        setFinalizando(false); // Voltar ao estado anterior
    } finally {
      setLoading(false);
    }
  };

  const addAmbiente = () => {
    if (!selectedAmbiente) return;

    const novoAmbiente: DraftAmbiente = {
      id: `ambiente_${Date.now()}`,
      nome: selectedAmbiente,
      comentario: comentarioAmbiente,
      fotos: [],
      ordem: draftVistoria.ambientes.length,
    };

    setDraftVistoria(prev => ({
      ...prev,
      ambientes: [...prev.ambientes, novoAmbiente],
    }));

    setSelectedAmbiente('');
    setComentarioAmbiente('');
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {WIZARD_STEPS.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const IconComponent = step.icon;

        return (
          <View key={step.id} style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              isActive && styles.stepActive,
              isCompleted && styles.stepCompleted,
            ]}>
              <IconComponent 
                size={16} 
                color={isActive || isCompleted ? colors.background : colors.textMuted} 
              />
            </View>
            <Text style={[
              styles.stepText,
              isActive && styles.stepTextActive,
            ]}>
              {step.title}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Informações Gerais
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Informações da Vistoria</Text>
            
            <Input
              label="Tipo de Vistoria"
              value={draftVistoria.tipo}
              editable={false}
              style={styles.readOnlyInput}
            />

            <Text style={styles.selectLabel}>Selecionar Imóvel</Text>
            <ScrollView style={styles.imovelList}>
              {imoveis.map((imovel) => (
                <TouchableOpacity
                  key={imovel.id}
                  style={[
                    styles.imovelItem,
                    draftVistoria.imovel_id === imovel.id && styles.imovelSelected,
                  ]}
                  onPress={() => setDraftVistoria(prev => ({ ...prev, imovel_id: imovel.id }))}
                >
                  <Text style={styles.imovelCode}>{imovel.codigo}</Text>
                  <Text style={styles.imovelAddress}>{imovel.endereco}</Text>
                  <Text style={styles.imovelType}>{imovel.tipo}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );

      case 1: // Ambientes
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Adicionar Ambientes</Text>
            
            <Text style={styles.selectLabel}>Selecionar Ambiente</Text>
            <ScrollView style={styles.ambienteList}>
              {AMBIENTES_PREDEFINIDOS.map((ambiente) => (
                <TouchableOpacity
                  key={ambiente}
                  style={[
                    styles.ambienteItem,
                    selectedAmbiente === ambiente && styles.ambienteSelected,
                  ]}
                  onPress={() => setSelectedAmbiente(ambiente)}
                >
                  <Text style={styles.ambienteText}>{ambiente}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Comentário do Ambiente"
              value={comentarioAmbiente}
              onChangeText={setComentarioAmbiente}
              multiline
              placeholder="Adicione observações sobre o ambiente..."
            />

            <Button
              title="Adicionar Ambiente"
              onPress={addAmbiente}
              disabled={!selectedAmbiente}
              style={styles.addButton}
            />

            {/* Lista de ambientes adicionados */}
            {draftVistoria.ambientes.length > 0 && (
              <View style={styles.ambientesAdicionados}>
                <Text style={styles.selectLabel}>Ambientes Adicionados ({draftVistoria.ambientes.length})</Text>
                {draftVistoria.ambientes.map((ambiente) => (
                  <Card key={ambiente.id} style={styles.ambienteCard}>
                    <View style={styles.ambienteHeader}>
                      <View style={styles.ambienteInfo}>
                        <Text style={styles.ambienteNome}>{ambiente.nome}</Text>
                        <Text style={styles.ambienteComentario}>{ambiente.comentario}</Text>
                        <Text style={styles.ambienteFotos}>
                          {ambiente.fotos?.length || 0} foto(s)
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.cameraButton}
                        onPress={() => router.push({
                          pathname: '/vistoria/batch-camera',
                          params: {
                            vistoriaId: draftVistoria.id,
                            ambiente: ambiente.nome
                          }
                        })}
                      >
                        <Camera size={20} color={colors.primary} />
                        <Text style={styles.cameraButtonText}>Fotografar</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}
              </View>
            )}
          </View>
        );

      case 2: // Revisão
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Revisão da Vistoria</Text>
            
            <Card style={styles.resumoCard}>
              <Text style={styles.resumoTitle}>Resumo</Text>
              <Text style={styles.resumoItem}>Tipo: {draftVistoria.tipo}</Text>
              <Text style={styles.resumoItem}>Ambientes: {draftVistoria.ambientes.length}</Text>
              <Text style={styles.resumoItem}>
                Imóvel: {imoveis.find(i => i.id === draftVistoria.imovel_id)?.codigo}
              </Text>
              
              {/* Lista detalhada dos ambientes */}
              <Text style={styles.resumoSubtitle}>Ambientes:</Text>
              {draftVistoria.ambientes.map((ambiente, index) => (
                <View key={ambiente.id} style={styles.resumoAmbiente}>
                  <Text style={styles.resumoAmbienteNome}>
                    {index + 1}. {ambiente.nome}
                  </Text>
                  <Text style={styles.resumoAmbienteInfo}>
                    {ambiente.fotos?.length || 0} foto(s)
                  </Text>
                  {ambiente.comentario && (
                    <Text style={styles.resumoAmbienteComentario}>
                      "{ambiente.comentario}"
                    </Text>
                  )}
                </View>
              ))}
            </Card>
            
            <Input
              label="Observações Gerais da Vistoria"
              value={observacoesGerais}
              onChangeText={setObservacoesGerais}
              multiline
              numberOfLines={4}
              placeholder="Adicione observações gerais sobre a vistoria..."
              style={styles.observacoesInput}
            />
          </View>
        );

      case 3: // Finalizar
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Finalizar Vistoria</Text>
            
            {!finalizando ? (
              <View style={styles.finalizePreview}>
                <Card style={styles.finalizeCard}>
                  <Text style={styles.finalizeCardTitle}>Confirmar Finalização</Text>
                  <Text style={styles.finalizeCardText}>
                    Você está prestes a finalizar esta vistoria:
                  </Text>
                  
                  <View style={styles.finalizeDetails}>
                    <Text style={styles.finalizeDetailItem}>
                      • {draftVistoria.ambientes.length} ambiente(s) cadastrado(s)
                    </Text>
                    <Text style={styles.finalizeDetailItem}>
                      • {draftVistoria.ambientes.reduce((total, amb) => total + (amb.fotos?.length || 0), 0)} foto(s) capturada(s)
                    </Text>
                    {observacoesGerais && (
                      <Text style={styles.finalizeDetailItem}>
                        • Observações gerais adicionadas
                      </Text>
                    )}
                  </View>
                  
                  <Text style={styles.finalizeWarning}>
                    Após finalizar, a vistoria será salva e você poderá continuar adicionando fotos se necessário.
                  </Text>
                </Card>
                
                <View style={styles.finalizeActions}>
                  <Button
                    title="Voltar para Revisão"
                    onPress={() => setCurrentStep(2)}
                    variant="outline"
                    style={styles.finalizeBackButton}
                  />
                  <Button
                     title="Finalizar Vistoria"
                     onPress={handleFinalize}
                     loading={loading}
                     style={styles.finalizeConfirmButton}
                   />
                </View>
              </View>
            ) : (
              <View style={styles.finalizeContent}>
                <CheckCircle size={64} color={colors.success} />
                <Text style={styles.finalizeTitle}>Vistoria Finalizada!</Text>
                <Text style={styles.finalizeText}>
                  A vistoria foi salva com sucesso. Você pode continuar adicionando fotos ou gerar o relatório final.
                </Text>
                
                <View style={styles.finalizeOptions}>
                  <Button
                    title="Ver Vistoria"
                    onPress={() => router.replace(`/vistoria/${draftVistoria.id}`)}
                    style={styles.finalizeOptionButton}
                  />
                  <Button
                    title="Nova Vistoria"
                    onPress={() => router.replace('/(tabs)')}
                    variant="outline"
                    style={styles.finalizeOptionButton}
                  />
                </View>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const isStepValid = () => {
    switch (currentStep) {
      case 0: return draftVistoria.imovel_id !== '';
      case 1: return draftVistoria.ambientes.length > 0;
      case 2: return true;
      case 3: return true;
      default: return false;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Vistoria</Text>
        <View style={styles.placeholder} />
      </View>

      {renderStepIndicator()}

      <ScrollView style={styles.content}>
        {renderStepContent()}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={currentStep === WIZARD_STEPS.length - 1 ? "Finalizar" : "Próximo"}
          onPress={handleNext}
          disabled={!isStepValid()}
          loading={loading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepActive: {
    backgroundColor: colors.primary,
  },
  stepCompleted: {
    backgroundColor: colors.success,
  },
  stepText: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stepTextActive: {
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: spacing.lg,
  },
  stepTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  readOnlyInput: {
    backgroundColor: colors.surfaceVariant,
    color: colors.textMuted,
  },
  selectLabel: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  imovelList: {
    maxHeight: 200,
    marginBottom: spacing.lg,
  },
  imovelItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imovelSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  imovelCode: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  imovelAddress: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  imovelType: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.textMuted,
  },
  ambienteList: {
    maxHeight: 150,
    marginBottom: spacing.lg,
  },
  ambienteItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ambienteSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  ambienteText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.textPrimary,
  },
  addButton: {
    marginBottom: spacing.lg,
  },
  ambientesAdicionados: {
    marginTop: spacing.lg,
  },
  ambienteCard: {
    marginBottom: spacing.sm,
  },
  ambienteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ambienteInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  ambienteNome: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  ambienteComentario: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  ambienteFotos: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  cameraButtonText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  resumoCard: {
    padding: spacing.lg,
  },
  resumoTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  resumoItem: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  resumoSubtitle: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  resumoAmbiente: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: 6,
    marginBottom: spacing.xs,
  },
  resumoAmbienteNome: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  resumoAmbienteInfo: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  resumoAmbienteComentario: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  observacoesInput: {
    marginTop: spacing.lg,
  },
  finalizePreview: {
    flex: 1,
  },
  finalizeCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  finalizeCardTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  finalizeCardText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  finalizeDetails: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
  },
  finalizeDetailItem: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  finalizeWarning: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  finalizeActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  finalizeBackButton: {
    flex: 1,
  },
  finalizeConfirmButton: {
    flex: 1,
  },
  finalizeContent: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  finalizeOptions: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  finalizeOptionButton: {
    width: '100%',
  },
  finalizeTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  finalizeText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});