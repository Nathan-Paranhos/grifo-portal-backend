import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { colors, typography, spacing, borderRadius } from '@/constants/colors';
import { Camera, RotateCcw, X, ArrowRight } from 'lucide-react-native';

export default function CameraScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Camera size={64} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Carregando câmera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Camera size={64} color={colors.primary} />
          <Text style={styles.permissionTitle}>Acesso à Câmera Necessário</Text>
          <Text style={styles.permissionText}>
            Precisamos do acesso à câmera para capturar fotos durante as vistorias
          </Text>
          <Button
            title="Permitir Acesso"
            onPress={requestPermission}
            style={styles.permissionButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const handleTakePicture = async () => {
    if (!cameraRef.current || isCapturing) return;
    
    try {
      setIsCapturing(true);
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        exif: false,
      });

      if (photo) {
        // Navigate to wizard with photo
        router.push({
          pathname: '/wizard',
          params: { photoUri: photo.uri }
        });
      }
    } catch (error) {
        // Error taking picture handled silently
        Alert.alert('Erro', 'Não foi possível capturar a foto. Tente novamente.');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleStartWizard = () => {
    router.push('/wizard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <X size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nova Vistoria</Text>
        <View style={styles.placeholder} />
      </View>

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        <View style={styles.cameraOverlay}>
          {/* Top Controls */}
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.flipButton}
              onPress={toggleCameraFacing}
            >
              <RotateCcw size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <Button
              title="Iniciar Wizard"
              onPress={handleStartWizard}
              variant="secondary"
              size="sm"
              icon={<ArrowRight size={16} color={colors.textPrimary} />}
            />
            
            <TouchableOpacity
              style={[styles.captureButton, isCapturing && styles.capturingButton]}
              onPress={handleTakePicture}
              disabled={isCapturing}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>
            
            <View style={styles.placeholder} />
          </View>
        </View>
      </CameraView>
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
  closeButton: {
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
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  topControls: {
    alignItems: 'flex-end',
  },
  flipButton: {
    backgroundColor: colors.overlay,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.textPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: colors.primary,
  },
  capturingButton: {
    opacity: 0.7,
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  permissionTitle: {
    fontSize: typography.size.xl,
    fontFamily: typography.fontFamily.semibold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: typography.size.md,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  permissionButton: {
    minWidth: 200,
  },
});