import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '../contexts/auth';
import { SettingsProvider, useSettings } from "../contexts/settings";
import { useEffect } from 'react';
import ForceLogoutModal from '../components/ForceLogoutModal';

try {
  const liveKitModule = require('@livekit/react-native') as {
    registerGlobals?: () => void;
  };
  liveKitModule.registerGlobals?.();
} catch {
  // Expo Go may not include native WebRTC. Keep app booting for non-call routes.
}

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { language, theme } = useSettings();
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = segments[0] as string | undefined;
    const inAuthGroup =
      firstSegment === 'login' ||
      firstSegment === 'register' ||
      firstSegment === 'register-verify' ||
      firstSegment === 'forgot-password' ||
      firstSegment === 'reset-password';

    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, isLoading, segments, router]);

  return (
    <ThemeProvider value={(theme === "dark" || (theme !== "light" && colorScheme === "dark")) ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="register-verify" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: language === "en" ? "Modal" : "Hộp thoại" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <RootLayoutNav />
        <ForceLogoutModal />
      </AuthProvider>
    </SettingsProvider>
  );
}
