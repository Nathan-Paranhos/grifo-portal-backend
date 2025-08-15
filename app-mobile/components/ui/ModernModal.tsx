import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import { colors, typography, spacing } from '@/constants/colors';

interface ModernModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'fullscreen' | 'bottom-sheet';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  animationType?: 'slide' | 'fade' | 'scale';
}

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');

export function ModernModal({
  visible,
  onClose,
  title,
  children,
  variant = 'default',
  showCloseButton = true,
  closeOnBackdrop = true,
  animationType = 'scale',
}: ModernModalProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const modalScale = useRef(new Animated.Value(0.8)).current;
  const modalTranslateY = useRef(new Animated.Value(screenHeight)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      showModal();
    } else {
      hideModal();
    }
  }, [visible]);

  const showModal = () => {
    const animations = [
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ];

    if (animationType === 'scale') {
      animations.push(
        Animated.spring(modalScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      );
    } else if (animationType === 'slide' || variant === 'bottom-sheet') {
      animations.push(
        Animated.spring(modalTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        })
      );
    } else {
      animations.push(
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start();
  };

  const hideModal = () => {
    const animations = [
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ];

    if (animationType === 'scale') {
      animations.push(
        Animated.timing(modalScale, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      );
    } else if (animationType === 'slide' || variant === 'bottom-sheet') {
      animations.push(
        Animated.timing(modalTranslateY, {
          toValue: screenHeight,
          duration: 250,
          useNativeDriver: true,
        })
      );
    } else {
      animations.push(
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        })
      );
    }

    Animated.parallel(animations).start();
  };

  const handleBackdropPress = () => {
    if (closeOnBackdrop) {
      onClose();
    }
  };

  const getModalStyle = () => {
    const baseStyle = [styles.modalContent];

    if (variant === 'fullscreen') {
      return [baseStyle, styles.fullscreenModal];
    }

    if (variant === 'bottom-sheet') {
      return [
        baseStyle,
        styles.bottomSheetModal,
        {
          transform: [{ translateY: modalTranslateY }],
        },
      ];
    }

    // Default modal
    const transform = [];
    if (animationType === 'scale') {
      transform.push({ scale: modalScale });
    }
    if (animationType === 'slide') {
      transform.push({ translateY: modalTranslateY });
    }

    return [
      baseStyle,
      styles.defaultModal,
      {
        opacity: animationType === 'fade' ? modalOpacity : 1,
        transform: transform.length > 0 ? transform : undefined,
      },
    ];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View style={getModalStyle()}>
          <LinearGradient
            colors={[colors.surface, `${colors.surface}F0`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {(title || showCloseButton) && (
              <View style={styles.header}>
                {title && <Text style={styles.title}>{title}</Text>}
                {showCloseButton && (
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}
                    activeOpacity={0.7}
                  >
                    <X size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {children}
            </ScrollView>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: `${colors.overlay}80`,
    backdropFilter: 'blur(10px)',
  },
  modalContent: {
    backgroundColor: 'transparent',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  defaultModal: {
    width: screenWidth - spacing.xl * 2,
    maxHeight: screenHeight * 0.8,
    borderRadius: spacing.borderRadius * 2,
    overflow: 'hidden',
  },
  fullscreenModal: {
    width: screenWidth,
    height: screenHeight,
    borderRadius: 0,
  },
  bottomSheetModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.9,
    borderTopLeftRadius: spacing.borderRadius * 2,
    borderTopRightRadius: spacing.borderRadius * 2,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.border}40`,
  },
  title: {
    flex: 1,
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    color: colors.text,
    textShadowColor: `${colors.shadow}20`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    padding: spacing.sm,
    borderRadius: spacing.borderRadius,
    backgroundColor: `${colors.surface}80`,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
});