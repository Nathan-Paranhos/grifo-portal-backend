import * as Location from 'expo-location';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
  address?: string;
}

export interface LocationServiceConfig {
  enableHighAccuracy: boolean;
  timeout: number;
  maximumAge: number;
  distanceInterval: number;
  timeInterval: number;
}

class LocationService {
  private static instance: LocationService;
  private watchSubscription: Location.LocationSubscription | null = null;
  private currentLocation: LocationData | null = null;
  private isTracking = false;
  
  private defaultConfig: LocationServiceConfig = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 10000,
    distanceInterval: 10, // metros
    timeInterval: 5000, // 5 segundos
  };

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  /**
   * Solicita permissões de localização
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (foregroundStatus !== 'granted') {
        Alert.alert(
          'Permissão Negada',
          'É necessário permitir o acesso à localização para usar esta funcionalidade.',
          [{ text: 'OK' }]
        );
        return false;
      }

      // Solicita permissão para localização em background (opcional)
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      
      return true;
    } catch (error) {
      console.error('Erro ao solicitar permissões de localização:', error);
      return false;
    }
  }

  /**
   * Verifica se as permissões estão concedidas
   */
  async hasPermissions(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Obtém a localização atual uma única vez
   */
  async getCurrentLocation(config?: Partial<LocationServiceConfig>): Promise<LocationData | null> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) return null;
      }

      const finalConfig = { ...this.defaultConfig, ...config };
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: finalConfig.enableHighAccuracy 
          ? Location.Accuracy.BestForNavigation 
          : Location.Accuracy.Balanced,
        maximumAge: finalConfig.maximumAge,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
        timestamp: location.timestamp,
      };

      // Tenta obter o endereço
      try {
        const address = await this.reverseGeocode(locationData.latitude, locationData.longitude);
        locationData.address = address;
      } catch (error) {
        console.warn('Erro ao obter endereço:', error);
      }

      this.currentLocation = locationData;
      await this.saveLocationToStorage(locationData);
      
      return locationData;
    } catch (error) {
      console.error('Erro ao obter localização atual:', error);
      Alert.alert(
        'Erro de Localização',
        'Não foi possível obter sua localização. Verifique se o GPS está ativado.',
        [{ text: 'OK' }]
      );
      return null;
    }
  }

  /**
   * Inicia o rastreamento contínuo da localização
   */
  async startLocationTracking(
    onLocationUpdate: (location: LocationData) => void,
    config?: Partial<LocationServiceConfig>
  ): Promise<boolean> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) return false;
      }

      if (this.isTracking) {
        await this.stopLocationTracking();
      }

      const finalConfig = { ...this.defaultConfig, ...config };
      
      this.watchSubscription = await Location.watchPositionAsync(
        {
          accuracy: finalConfig.enableHighAccuracy 
            ? Location.Accuracy.BestForNavigation 
            : Location.Accuracy.Balanced,
          timeInterval: finalConfig.timeInterval,
          distanceInterval: finalConfig.distanceInterval,
        },
        async (location) => {
          const locationData: LocationData = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy || 0,
            altitude: location.coords.altitude || undefined,
            heading: location.coords.heading || undefined,
            speed: location.coords.speed || undefined,
            timestamp: location.timestamp,
          };

          // Tenta obter o endereço (opcional para não impactar performance)
          try {
            const address = await this.reverseGeocode(locationData.latitude, locationData.longitude);
            locationData.address = address;
          } catch (error) {
            // Ignora erro de geocoding para não interromper o tracking
          }

          this.currentLocation = locationData;
          await this.saveLocationToStorage(locationData);
          onLocationUpdate(locationData);
        }
      );

      this.isTracking = true;
      return true;
    } catch (error) {
      console.error('Erro ao iniciar rastreamento:', error);
      return false;
    }
  }

  /**
   * Para o rastreamento de localização
   */
  async stopLocationTracking(): Promise<void> {
    if (this.watchSubscription) {
      this.watchSubscription.remove();
      this.watchSubscription = null;
    }
    this.isTracking = false;
  }

  /**
   * Converte coordenadas em endereço
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (result && result.length > 0) {
        const address = result[0];
        const parts = [
          address.street,
          address.streetNumber,
          address.district,
          address.city,
          address.region,
          address.postalCode
        ].filter(Boolean);
        
        return parts.join(', ');
      }
      
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    } catch (error) {
      console.error('Erro no geocoding reverso:', error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  }

  /**
   * Converte endereço em coordenadas
   */
  async geocode(address: string): Promise<LocationData | null> {
    try {
      const result = await Location.geocodeAsync(address);
      
      if (result && result.length > 0) {
        const coords = result[0];
        return {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: 0,
          timestamp: Date.now(),
          address,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Erro no geocoding:', error);
      return null;
    }
  }

  /**
   * Calcula a distância entre duas coordenadas (em metros)
   */
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Salva localização no storage local
   */
  private async saveLocationToStorage(location: LocationData): Promise<void> {
    try {
      await AsyncStorage.setItem('lastKnownLocation', JSON.stringify(location));
    } catch (error) {
      console.error('Erro ao salvar localização:', error);
    }
  }

  /**
   * Recupera última localização conhecida do storage
   */
  async getLastKnownLocation(): Promise<LocationData | null> {
    try {
      const stored = await AsyncStorage.getItem('lastKnownLocation');
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Erro ao recuperar localização:', error);
      return null;
    }
  }

  /**
   * Obtém a localização atual armazenada em memória
   */
  getCurrentLocationFromMemory(): LocationData | null {
    return this.currentLocation;
  }

  /**
   * Verifica se está rastreando localização
   */
  isLocationTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Limpa dados de localização
   */
  async clearLocationData(): Promise<void> {
    try {
      await AsyncStorage.removeItem('lastKnownLocation');
      this.currentLocation = null;
    } catch (error) {
      console.error('Erro ao limpar dados de localização:', error);
    }
  }
}

export default LocationService.getInstance();