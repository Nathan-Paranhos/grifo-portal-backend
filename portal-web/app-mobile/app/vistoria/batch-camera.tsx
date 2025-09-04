import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { usePhotoManager } from '@/hooks/usePhotoManager';
import { colors, typography, spacing } from '@/constants/colors';
import {
  ArrowLeft,
  Camera,
  RotateCcw,
  Check,
  X,
  Plus,
  MessageSquare,
  Home,
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface CapturedPhoto {
  id: string;
  uri: string;
  ambiente?: string;
  comentario?: string;
}

interface Ambiente {
  id: string;
  nome: string;
}

const AMBIENTES_PADRAO: Ambiente[] = [
  { id: '1', nome: 'Sala' },
  { id: '2', nome: 'Cozinha' },
  { id: '3', nome: 'Quarto 1' },
  { id: '4', nome: 'Quarto 2' },
  { id: '5', nome: 'Banheiro' },
  { id: '6', nome: 'Área de Serviço' },
  { id: '7', nome: 'Varanda' },
  { id: '8', nome: 'Garagem' },
];

export default function BatchCameraScreen() {
  const { vistoriaId } = useLocalSearchParams<{ vistoriaId: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showAmbienteModal, setShowAmbienteModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [comentario, setComentario] = useState('');
  const [ambientes, setAmbientes] = useState<Ambiente[]>(AMBIENTES_PADRAO);
  const [selectedAmbiente, setSelectedAmbiente] = useState<string>('');
  const [novoAmbiente, setNovoAmbiente] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const { uploadPhoto } = usePhotoManager({
    vistoriaId,
    enableCache: true,
  });

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      if (photo) {
        const newPhoto: CapturedPhoto = {
          id: Date.now().toString(),
          uri: photo.uri,
        };
        setCapturedPhotos(prev => [...prev, newPhoto]);
        setShowPreview(true);
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível capturar a foto');
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const removePhoto = (photoId: string) => {
    setCapturedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  };

  const openCommentModal = (index: number) => {
    setCurrentPhotoIndex(index);
    setComentario(capturedPhotos[index]?.comentario || '');
    setShowCommentModal(true);
  };

  const saveComment = () => {
    setCapturedPhotos(prev => 
      prev.map((photo, index) => 
        index === currentPhotoIndex 
          ? { ...photo, comentario }
          : photo
      )
    );
    setComentario('');
    setShowCommentModal(false);
  };

  const openAmbienteModal = (index: number) => {
    setCurrentPhotoIndex(index);
    setSelectedAmbiente(capturedPhotos[index]?.ambiente || '');
    setShowAmbienteModal(true);
  };

  const addNovoAmbiente = () => {
    if (novoAmbiente.trim()) {
      const newAmbiente: Ambiente = {
        id: Date.now().toString(),
        nome: novoAmbiente.trim(),
      };
      setAmbientes(prev => [...prev, newAmbiente]);
      setSelectedAmbiente(newAmbiente.id);
      setNovoAmbiente('');
    }
  };

  const saveAmbiente = () => {
    const ambiente = ambientes.find(a => a.id === selectedAmbiente);
    setCapturedPhotos(prev => 
      prev.map((photo, index) => 
        index === currentPhotoIndex 
          ? { ...photo, ambiente: ambiente?.nome }
          : photo
      )
    );
    setSelectedAmbiente('');
    setShowAmbienteModal(false);
  };

  const finalizarCaptura = async () => {
    if (capturedPhotos.length === 0) {
      Alert.alert('Aviso', 'Capture pelo menos uma foto antes de finalizar.');
      return;
    }

    Alert.alert(
      'Finalizar Captura',
      `Deseja finalizar a captura com ${capturedPhotos.length} foto(s)?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          onPress: async () => {
            setIsUploading(true);
            
            try {
              // Upload das fotos
              for (const photo of capturedPhotos) {
                const success = await uploadPhoto(
                  photo.uri,
                  vistoriaId,
                  photo.ambiente || 'Sem ambiente',
                  photo.comentario || ''
                );
              }
              
              Alert.alert(
                'Sucesso',
                'Fotos enviadas com sucesso!',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              Alert.alert('Erro', 'Falha ao enviar algumas fotos. Tente novamente.');
            } finally {
              setIsUploading(false);
            }
          },
        },
      ]
    );
  };

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Precisamos da sua permissão para usar a câmera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Conceder Permissão</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.background} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Captura em Lote</Text>
        <TouchableOpacity style={styles.headerButton} onPress={toggleCameraFacing}>
          <RotateCcw size={24} color={colors.background} />
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
        />
      </View>

      {/* Preview Strip */}
      {capturedPhotos.length > 0 && (
        <View style={styles.previewStrip}>
          <FlatList
            horizontal
            data={capturedPhotos}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item, index }) => (
              <View style={styles.previewItem}>
                <Image source={{ uri: item.uri }} style={styles.previewImage} />
                <View style={styles.previewOverlay}>
                  <TouchableOpacity
                    style={styles.previewAction}
                    onPress={() => openAmbienteModal(index)}
                  >
                    <Home size={16} color={colors.background} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.previewAction}
                    onPress={() => openCommentModal(index)}
                  >
                    <MessageSquare size={16} color={colors.background} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.previewAction, styles.deleteAction]}
                    onPress={() => removePhoto(item.id)}
                  >
                    <X size={16} color={colors.background} />
                  </TouchableOpacity>
                </View>
                {item.ambiente && (
                  <Text style={styles.previewLabel}>{item.ambiente}</Text>
                )}
              </View>
            )}
          />
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <Text style={styles.photoCount}>{capturedPhotos.length} fotos</Text>
          
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
            disabled={isUploading}
          >
            <Camera size={32} color={colors.background} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.finishButton, isUploading && styles.finishButtonDisabled]}
            onPress={finalizarCaptura}
            disabled={isUploading}
          >
            <Check size={24} color={colors.background} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Comment Modal */}
      <Modal
        visible={showCommentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCommentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Adicionar Comentário</Text>
            <TextInput
              style={styles.commentInput}
              value={comentario}
              onChangeText={setComentario}
              placeholder="Digite um comentário para esta foto..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCommentModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveComment}
              >
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Ambiente Modal */}
      <Modal
        visible={showAmbienteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAmbienteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar Ambiente</Text>
            
            <FlatList
              data={ambientes}
              keyExtractor={(item) => item.id}
              style={styles.ambienteList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.ambienteItem,
                    selectedAmbiente === item.id && styles.ambienteItemSelected
                  ]}
                  onPress={() => setSelectedAmbiente(item.id)}
                >
                  <Text style={[
                    styles.ambienteText,
                    selectedAmbiente === item.id && styles.ambienteTextSelected
                  ]}>
                    {item.nome}
                  </Text>
                </TouchableOpacity>
              )}
            />
            
            <View style={styles.novoAmbienteContainer}>
              <TextInput
                style={styles.novoAmbienteInput}
                value={novoAmbiente}
                onChangeText={setNovoAmbiente}
                placeholder="Novo ambiente..."
              />
              <TouchableOpacity
                style={styles.addAmbienteButton}
                onPress={addNovoAmbiente}
              >
                <Plus size={20} color={colors.background} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAmbienteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveAmbiente}
              >
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  permissionText: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.medium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.background,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  previewStrip: {
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: spacing.sm,
  },
  previewItem: {
    marginHorizontal: spacing.xs,
    position: 'relative',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  previewOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
  },
  previewAction: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    borderRadius: 4,
    marginLeft: 2,
  },
  deleteAction: {
    backgroundColor: colors.danger,
  },
  previewLabel: {
    fontSize: typography.size.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.background,
    textAlign: 'center',
    marginTop: 4,
  },
  controls: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoCount: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.medium,
    color: colors.background,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.background,
  },
  finishButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  finishButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.xl,
    width: screenWidth * 0.9,
    maxHeight: screenHeight * 0.8,
  },
  modalTitle: {
    fontSize: typography.size.lg,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
    minHeight: 100,
    marginBottom: spacing.lg,
  },
  ambienteList: {
    maxHeight: 200,
    marginBottom: spacing.lg,
  },
  ambienteItem: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceVariant,
  },
  ambienteItemSelected: {
    backgroundColor: colors.primary + '20',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ambienteText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
  },
  ambienteTextSelected: {
    color: colors.primary,
    fontFamily: typography.fontFamily.semibold,
  },
  novoAmbienteContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  novoAmbienteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textPrimary,
  },
  addAmbienteButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surfaceVariant,
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
    color: colors.background,
  },
});