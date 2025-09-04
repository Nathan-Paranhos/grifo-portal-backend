import { useState, useEffect, useCallback, useRef } from 'react';
import LocationService, { LocationData, LocationServiceConfig } from '../services/locationService';

export interface UseLocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceInterval?: number;
  timeInterval?: number;
  autoStart?: boolean;
  trackContinuously?: boolean;
}

export interface UseLocationReturn {
  location: LocationData | null;
  isLoading: boolean;
  error: string | null;
  hasPermission: boolean;
  isTracking: boolean;
  getCurrentLocation: () => Promise<void>;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  requestPermissions: () => Promise<void>;
  clearError: () => void;
  getDistance: (lat: number, lon: number) => number | null;
  getLastKnownLocation: () => Promise<LocationData | null>;
}

const useLocation = (options: UseLocationOptions = {}): UseLocationReturn => {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 10000,
    distanceInterval = 10,
    timeInterval = 5000,
    autoStart = false,
    trackContinuously = false,
  } = options;

  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  
  const locationServiceRef = useRef(LocationService);
  const isMountedRef = useRef(true);

  const config: LocationServiceConfig = {
    enableHighAccuracy,
    timeout,
    maximumAge,
    distanceInterval,
    timeInterval,
  };

  // Verifica permissões na inicialização
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const hasPerms = await locationServiceRef.current.hasPermissions();
        if (isMountedRef.current) {
          setHasPermission(hasPerms);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError('Erro ao verificar permissões de localização');
        }
      }
    };

    checkPermissions();
  }, []);

  // Auto-start se habilitado
  useEffect(() => {
    if (autoStart && hasPermission) {
      if (trackContinuously) {
        startTracking();
      } else {
        getCurrentLocation();
      }
    }

    return () => {
      isMountedRef.current = false;
      if (isTracking) {
        locationServiceRef.current.stopLocationTracking();
      }
    };
  }, [autoStart, hasPermission, trackContinuously]);

  // Carrega última localização conhecida na inicialização
  useEffect(() => {
    const loadLastKnownLocation = async () => {
      try {
        const lastLocation = await locationServiceRef.current.getLastKnownLocation();
        if (lastLocation && isMountedRef.current) {
          setLocation(lastLocation);
        }
      } catch (err) {
        console.warn('Erro ao carregar última localização:', err);
      }
    };

    loadLastKnownLocation();
  }, []);

  const requestPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const granted = await locationServiceRef.current.requestPermissions();
      
      if (isMountedRef.current) {
        setHasPermission(granted);
        if (!granted) {
          setError('Permissões de localização negadas');
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Erro ao solicitar permissões de localização');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const getCurrentLocation = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const currentLocation = await locationServiceRef.current.getCurrentLocation(config);
      
      if (isMountedRef.current) {
        if (currentLocation) {
          setLocation(currentLocation);
        } else {
          setError('Não foi possível obter a localização atual');
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Erro ao obter localização atual');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [config]);

  const startTracking = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await locationServiceRef.current.startLocationTracking(
        (newLocation) => {
          if (isMountedRef.current) {
            setLocation(newLocation);
          }
        },
        config
      );
      
      if (isMountedRef.current) {
        if (success) {
          setIsTracking(true);
        } else {
          setError('Não foi possível iniciar o rastreamento de localização');
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Erro ao iniciar rastreamento de localização');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [config]);

  const stopTracking = useCallback(async () => {
    try {
      await locationServiceRef.current.stopLocationTracking();
      if (isMountedRef.current) {
        setIsTracking(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError('Erro ao parar rastreamento de localização');
      }
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getDistance = useCallback((lat: number, lon: number): number | null => {
    if (!location) return null;
    
    return locationServiceRef.current.calculateDistance(
      location.latitude,
      location.longitude,
      lat,
      lon
    );
  }, [location]);

  const getLastKnownLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      return await locationServiceRef.current.getLastKnownLocation();
    } catch (err) {
      console.error('Erro ao obter última localização:', err);
      return null;
    }
  }, []);

  return {
    location,
    isLoading,
    error,
    hasPermission,
    isTracking,
    getCurrentLocation,
    startTracking,
    stopTracking,
    requestPermissions,
    clearError,
    getDistance,
    getLastKnownLocation,
  };
};

export default useLocation;