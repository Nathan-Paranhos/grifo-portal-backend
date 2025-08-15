import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { Trash2, Edit, Archive, Star } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/colors';

interface SwipeAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  backgroundColor: string;
  onPress: () => void;
}

interface ModernSwipeableRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  swipeThreshold?: number;
}

const { width: screenWidth } = Dimensions.get('window');
const ACTION_WIDTH = 80;

export function ModernSwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  onSwipeStart,
  onSwipeEnd,
  swipeThreshold = 0.3,
}: ModernSwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowRef = useRef<View>(null);
  const isSwipingRef = useRef(false);

  const maxLeftSwipe = leftActions.length * ACTION_WIDTH;
  const maxRightSwipe = -(rightActions.length * ACTION_WIDTH);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    {
      useNativeDriver: false,
      listener: (event) => {
        const { translationX } = event.nativeEvent;
        
        if (!isSwipingRef.current && Math.abs(translationX) > 10) {
          isSwipingRef.current = true;
          onSwipeStart?.();
        }
      },
    }
  );

  const onHandlerStateChange = (event: any) => {
    const { translationX, velocityX, state } = event.nativeEvent;

    if (state === 5) { // END state
      isSwipingRef.current = false;
      onSwipeEnd?.();

      let targetValue = 0;
      const swipeDistance = Math.abs(translationX);
      const shouldComplete = swipeDistance > screenWidth * swipeThreshold || Math.abs(velocityX) > 500;

      if (shouldComplete) {
        if (translationX > 0 && leftActions.length > 0) {
          targetValue = maxLeftSwipe;
        } else if (translationX < 0 && rightActions.length > 0) {
          targetValue = maxRightSwipe;
        }
      }

      Animated.spring(translateX, {
        toValue: targetValue,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }).start();
    }
  };

  const resetPosition = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const renderActions = (actions: SwipeAction[], side: 'left' | 'right') => {
    if (actions.length === 0) return null;

    return (
      <View style={[styles.actionsContainer, side === 'left' ? styles.leftActions : styles.rightActions]}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={action.id}
            style={[styles.actionButton, { width: ACTION_WIDTH }]}
            onPress={() => {
              action.onPress();
              resetPosition();
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[action.backgroundColor, `${action.backgroundColor}E0`]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <action.icon size={24} color={action.color} />
              <Text style={[styles.actionLabel, { color: action.color }]}>
                {action.label}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderActions(leftActions, 'left')}
      {renderActions(rightActions, 'right')}
      
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-20, 20]}
      >
        <Animated.View
          ref={rowRef}
          style={[
            styles.row,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

// Predefined common actions
export const SwipeActions = {
  delete: (onPress: () => void): SwipeAction => ({
    id: 'delete',
    label: 'Excluir',
    icon: Trash2,
    color: colors.surface,
    backgroundColor: colors.danger,
    onPress,
  }),
  
  edit: (onPress: () => void): SwipeAction => ({
    id: 'edit',
    label: 'Editar',
    icon: Edit,
    color: colors.surface,
    backgroundColor: colors.accent,
    onPress,
  }),
  
  archive: (onPress: () => void): SwipeAction => ({
    id: 'archive',
    label: 'Arquivar',
    icon: Archive,
    color: colors.surface,
    backgroundColor: colors.warning,
    onPress,
  }),
  
  favorite: (onPress: () => void): SwipeAction => ({
    id: 'favorite',
    label: 'Favorito',
    icon: Star,
    color: colors.surface,
    backgroundColor: colors.success,
    onPress,
  }),
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  row: {
    backgroundColor: colors.surface,
    zIndex: 1,
  },
  actionsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 0,
  },
  leftActions: {
    left: 0,
  },
  rightActions: {
    right: 0,
  },
  actionButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.fontFamily.medium,
    textAlign: 'center',
    textShadowColor: `${colors.shadow}40`,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});