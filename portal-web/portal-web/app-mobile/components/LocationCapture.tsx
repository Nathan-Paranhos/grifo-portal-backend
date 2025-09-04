import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { MapPin, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react-native';
import useLocation from '../hooks/useLocation';

interface LocationCaptureProps {
  onLocationCapture?: (location: { latitude: number; longitude: number; address?: string }) => void;
  onError?: (error: string) => void;
  autoCapture?: boolean;
  showAddress?: boolean;
  style?: any;
  disabled?: boolean;
}

const LocationCapture: React.FC<LocationCaptureProps> = ({
  onLocationCapture,
  onError,
  autoCapture = false,
  showAddress = true,
  style,
  disabled = false,
}) => {
  const {
    location,
    isLoading,
    error,
    hasPermission,
    getCurrentLocation,
    requestPermissions,
    clearError,
  } = useLocation({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 30000,
    autoStart: autoCapture,
  });

  const [captureStatus, setCaptureStatus] = useState<'idle' | 'capturing' | 'success' | 'error'>('idle');

  // Efeito para captura automática
  useEffect(() => {
    if (autoCapture && hasPermission && !location && !isLoading) {
      handleLocationCapture();
    }
  }, [autoCapture, hasPermission]);

  // Efeito para notificar sobre localização capturada
  useEffect(() => {
    if (location && onLocationCapture) {
      onLocationCapture({
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
      });
      setCaptureStatus('success');
    }
  }, [location, onLocationCapture]);

  // Efeito para notificar sobre erros
  useEffect(() => {
    if (error) {
      setCaptureStatus('error');
      if (onError) {
        onError(error);
      }
    }
  }, [error, onError]);

  const handleLocationCapture = async () => {
    if (disabled) return;

    setCaptureStatus('capturing');
    clearError();

    try {
      if (!hasPermission) {
        await requestPermissions();
        return;
      }

      await getCurrentLocation();
    } catch (err) {
      setCaptureStatus('error');
      Alert.alert(
        'Erro de Localização',
        'Não foi possível obter sua localização. Verifique se o GPS está ativado e tente novamente.',
        [{ text: 'OK' }]
      );
    }
  };

  const handlePermissionRequest = async () => {
    try {
      await requestPermissions();
      if (hasPermission) {
        handleLocationCapture();
      }
    } catch (err) {
      Alert.alert(
        'Permissões Necessárias',
        'Para capturar a localização, é necessário conceder permissão de acesso ao GPS.',
        [{ text: 'OK' }]
      );
    }
  };

  const getStatusIcon = () => {
    switch (captureStatus) {
      case 'capturing':
        return <ActivityIndicator size="small" color="#3B82F6" />;
      case 'success':
        return <CheckCircle size={20} color="#10B981" />;
      case 'error':
        return <AlertCircle size={20} color="#EF4444" />;
      default:
        return <MapPin size={20} color="#6B7280" />;
    }
  };

  const getStatusText = () => {
    if (isLoading || captureStatus === 'capturing') {
      return 'Capturando localização...';
    }
    
    if (!hasPermission) {
      return 'Permissão necessária';
    }
    
    if (error || captureStatus === 'error') {
      return 'Erro ao capturar localização';
    }
    
    if (location && captureStatus === 'success') {
      return 'Localização capturada';
    }
    
    return 'Capturar localização';
  };

  const getStatusColor = () => {
    switch (captureStatus) {
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      case 'capturing':
        return '#3B82F6';
      default:
        return '#6B7280';
    }
  };

  return (
    <View style={[{ padding: 16, backgroundColor: '#F9FAFB', borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' }, style]}>
      {/* Botão de captura */}
      <TouchableOpacity
        onPress={!hasPermission ? handlePermissionRequest : handleLocationCapture}
        disabled={disabled || isLoading}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          backgroundColor: disabled ? '#F3F4F6' : '#FFFFFF',
          borderRadius: 6,
          borderWidth: 1,
          borderColor: getStatusColor(),
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {getStatusIcon()}
        <Text
          style={{
            marginLeft: 8,
            fontSize: 16,
            fontWeight: '500',
            color: disabled ? '#9CA3AF' : getStatusColor(),
          }}
        >
          {getStatusText()}
        </Text>
      </TouchableOpacity>

      {/* Informações da localização */}
      {location && (
        <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFFFF', borderRadius: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <MapPin size={16} color="#10B981" />
            <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '500', color: '#374151' }}>
              Coordenadas GPS
            </Text>
          </View>
          
          <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 2 }}>
            Latitude: {location.latitude.toFixed(6)}
          </Text>
          
          <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
            Longitude: {location.longitude.toFixed(6)}
          </Text>
          
          {showAddress && location.address && (
            <Text style={{ fontSize: 12, color: '#374151', fontStyle: 'italic' }}>
              {location.address}
            </Text>
          )}
          
          <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>
            Precisão: ±{location.accuracy?.toFixed(0) || 'N/A'}m
          </Text>
        </View>
      )}

      {/* Mensagem de erro */}
      {error && (
        <View style={{ marginTop: 8, padding: 8, backgroundColor: '#FEF2F2', borderRadius: 4, borderWidth: 1, borderColor: '#FECACA' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AlertCircle size={16} color="#EF4444" />
            <Text style={{ marginLeft: 6, fontSize: 12, color: '#DC2626' }}>
              {error}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={clearError}
            style={{ marginTop: 4, alignSelf: 'flex-start' }}
          >
            <Text style={{ fontSize: 12, color: '#3B82F6', textDecorationLine: 'underline' }}>
              Tentar novamente
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Botão de atualização manual */}
      {location && !autoCapture && (
        <TouchableOpacity
          onPress={handleLocationCapture}
          disabled={disabled || isLoading}
          style={{
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
            backgroundColor: '#F3F4F6',
            borderRadius: 4,
          }}
        >
          <RefreshCw size={14} color="#6B7280" />
          <Text style={{ marginLeft: 4, fontSize: 12, color: '#6B7280' }}>
            Atualizar localização
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default LocationCapture;