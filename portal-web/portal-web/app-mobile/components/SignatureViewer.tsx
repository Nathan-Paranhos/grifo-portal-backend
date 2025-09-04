import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
  Alert,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignatureData } from '@/services/signatureService';
import { colors, typography, spacing } from '@/constants/colors';
import {
  X,
  User,
  Calendar,
  Shield,
  Share2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface SignatureViewerProps {
  signature: SignatureData | null;
  visible: boolean;
  onClose: () => void;
}

export function SignatureViewer({
  signature,
  visible,
  onClose
}: SignatureViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  if (!signature) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'vistoriador':
        return 'Vistoriador';
      case 'cliente':
        return 'Cliente';
      case 'testemunha':
        return 'Testemunha';
      default:
        return tipo;
    }
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'vistoriador':
        return colors.primary;
      case 'cliente':
        return colors.success;
      case 'testemunha':
        return colors.info;
      default:
        return colors.textMuted;
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleSaveToGallery = async () => {
    try {
      setSaving(true);
      
      // Solicitar permissão para acessar a galeria
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'É necessário permitir o acesso à galeria para salvar a assinatura.');
        return;
      }

      // Converter base64 para arquivo
      const base64Data = signature.assinatura_base64.replace(/^data:image\/[a-z]+;base64,/, '');
      const filename = `assinatura_${signature.nome_assinante.replace(/\s+/g, '_')}_${Date.now()}.png`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Salvar na galeria
      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('Vistorias - Assinaturas', asset, false);

      // Limpar arquivo temporário
      await FileSystem.deleteAsync(fileUri, { idempotent: true });

      Alert.alert('Sucesso', 'Assinatura salva na galeria com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar assinatura:', error);
      Alert.alert('Erro', 'Não foi possível salvar a assinatura na galeria.');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    try {
      // Converter base64 para arquivo temporário
      const base64Data = signature.assinatura_base64.replace(/^data:image\/[a-z]+;base64,/, '');
      const filename = `assinatura_${signature.nome_assinante.replace(/\s+/g, '_')}.png`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Share.share({
        url: fileUri,
        title: `Assinatura de ${signature.nome_assinante}`,
        message: `Assinatura digital de ${signature.nome_assinante} (${getTipoLabel(signature.tipo)}) - ${formatDate(signature.data_assinatura)}`
      });
    } catch (error) {
      console.error('Erro ao compartilhar assinatura:', error);
      Alert.alert('Erro', 'Não foi possível compartilhar a assinatura.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.tipoBadge, { backgroundColor: getTipoColor(signature.tipo) + '20' }]}>
              <Text style={[styles.tipoText, { color: getTipoColor(signature.tipo) }]}>
                {getTipoLabel(signature.tipo)}
              </Text>
            </View>
          </View>
          
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleShare}>
              <Share2 size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerButton} 
              onPress={handleSaveToGallery}
              disabled={saving}
            >
              <Download size={20} color={saving ? colors.textMuted : colors.textPrimary} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Informações do Assinante */}
        <View style={styles.signerInfo}>
          <View style={styles.signerRow}>
            <User size={16} color={colors.textSecondary} />
            <Text style={styles.signerName}>{signature.nome_assinante}</Text>
          </View>
          
          {signature.cpf_assinante && (
            <View style={styles.signerRow}>
              <Shield size={16} color={colors.textSecondary} />
              <Text style={styles.signerCpf}>CPF: {signature.cpf_assinante}</Text>
            </View>
          )}
          
          <View style={styles.signerRow}>
            <Calendar size={16} color={colors.textSecondary} />
            <Text style={styles.signatureDate}>
              {formatDate(signature.data_assinatura)}
            </Text>
          </View>
        </View>

        {/* Assinatura */}
        <View style={styles.signatureContainer}>
          <Image
            source={{ uri: signature.assinatura_base64 }}
            style={[
              styles.signatureImage,
              {
                transform: [{ scale: zoom }]
              }
            ]}
            resizeMode="contain"
          />
        </View>

        {/* Controles de Zoom */}
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, zoom <= 0.5 && styles.disabledButton]}
            onPress={handleZoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut size={20} color={zoom <= 0.5 ? colors.textMuted : colors.textPrimary} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.zoomButton} onPress={handleResetZoom}>
            <RotateCcw size={20} color={colors.textPrimary} />
            <Text style={styles.zoomText}>{Math.round(zoom * 100)}%</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.zoomButton, zoom >= 3 && styles.disabledButton]}
            onPress={handleZoomIn}
            disabled={zoom >= 3}
          >
            <ZoomIn size={20} color={zoom >= 3 ? colors.textMuted : colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flex: 1,
  },
  tipoBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tipoText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.semibold,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  signerInfo: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  signerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  signerName: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
  },
  signerCpf: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  signatureDate: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  signatureContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  signatureImage: {
    width: screenWidth - (spacing.lg * 2),
    height: screenHeight * 0.4,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.lg,
  },
  zoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabledButton: {
    opacity: 0.5,
  },
  zoomText: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.textPrimary,
  },
});