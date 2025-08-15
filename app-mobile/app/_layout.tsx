import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts, 
  Poppins_400Regular, 
  Poppins_500Medium, 
  Poppins_600SemiBold,
  Poppins_700Bold 
} from '@expo-google-fonts/poppins';
import * as SplashScreen from 'expo-splash-screen';
import { ModernStatusBar } from '@/components/ui/ModernStatusBar';
import { colors } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ModernStatusBar variant="gradient" style="light" />
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          animationDuration: 300,
        }}
      >
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false,
            animation: 'fade',
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_right',
          }} 
        />
        <Stack.Screen 
          name="wizard" 
          options={{ 
            headerShown: false,
            animation: 'slide_from_bottom',
          }} 
        />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SafeAreaProvider>
  );
}