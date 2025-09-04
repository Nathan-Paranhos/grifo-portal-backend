import { useState, useCallback } from 'react';

interface ToastState {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  position: 'top' | 'bottom';
}

const initialState: ToastState = {
  visible: false,
  message: '',
  type: 'info',
  duration: 3000,
  position: 'top',
};

export function useToast() {
  const [toast, setToast] = useState<ToastState>(initialState);

  const showToast = useCallback((
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    options?: {
      duration?: number;
      position?: 'top' | 'bottom';
    }
  ) => {
    setToast({
      visible: true,
      message,
      type,
      duration: options?.duration ?? 3000,
      position: options?.position ?? 'top',
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const showSuccess = useCallback((message: string, options?: { duration?: number; position?: 'top' | 'bottom' }) => {
    showToast(message, 'success', options);
  }, [showToast]);

  const showError = useCallback((message: string, options?: { duration?: number; position?: 'top' | 'bottom' }) => {
    showToast(message, 'error', options);
  }, [showToast]);

  const showWarning = useCallback((message: string, options?: { duration?: number; position?: 'top' | 'bottom' }) => {
    showToast(message, 'warning', options);
  }, [showToast]);

  const showInfo = useCallback((message: string, options?: { duration?: number; position?: 'top' | 'bottom' }) => {
    showToast(message, 'info', options);
  }, [showToast]);

  return {
    toast,
    showToast,
    hideToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}