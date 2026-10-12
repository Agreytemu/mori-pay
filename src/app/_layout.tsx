import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { AppLockPrompt } from '@/components/auth/AppLockPrompt';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { APP } from '@/constants/app';
import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useAppTheme } from '@/theme';

const appLogo = require('../../assets/images/brand-mark.png');
const interFonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

/**
 * Root navigator. Owns the theme, the safe-area context, the session provider
 * and the single screen stack that hosts the tab group and the auth flow.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <FontGate />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function FontGate() {
  const [attempt, setAttempt] = useState(0);
  const [continueWithoutFonts, setContinueWithoutFonts] = useState(false);

  if (continueWithoutFonts) {
    return (
      <SessionProvider>
        <GuardedStack />
      </SessionProvider>
    );
  }

  return (
    <FontLoadAttempt
      key={attempt}
      onRetry={() => setAttempt((current) => current + 1)}
      onContinue={() => setContinueWithoutFonts(true)}
    />
  );
}

function FontLoadAttempt({
  onRetry,
  onContinue,
}: {
  onRetry: () => void;
  onContinue: () => void;
}) {
  const [fontsLoaded, fontError] = useFonts(interFonts);

  useEffect(() => {
    if (fontError) {
      console.error('Mori Pay could not load the Inter font family.', fontError);
    }
  }, [fontError]);

  if (fontError) {
    return <FontLoadError onRetry={onRetry} onContinue={onContinue} />;
  }

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <SessionProvider>
      <GuardedStack />
    </SessionProvider>
  );
}

function FontLoadError({ onRetry, onContinue }: { onRetry: () => void; onContinue: () => void }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.root, styles.storageError, { backgroundColor: colors.background }]}>
      <AppText variant="title3" align="center">Could not load Mori Pay fonts</AppText>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center">
        Inter could not be loaded. Retry, or continue with your device font.
      </AppText>
      <PrimaryButton label="Retry" block onPress={onRetry} />
      <SecondaryButton label="Continue with device font" block onPress={onContinue} />
    </View>
  );
}

function ThemedStack() {
  const { colors, scheme } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'none',
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      </Stack>
      <AppLockPrompt />
    </View>
  );
}

/** Redirects between the auth flow and the app based on session state. */
function useAuthGuard() {
  const segments = useSegments();
  const router = useRouter();
  const { status, pin } = useSession();

  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (status === 'authenticated' && inAuthGroup && pin?.pinSet) {
      router.replace('/(tabs)');
    }
  }, [status, inAuthGroup, pin?.pinSet, router]);
}

function GuardedStack() {
  const { status, appLockReady, appLockStorageError, reloadAppLock } = useSession();
  useAuthGuard();

  if (status === 'loading' || !appLockReady) {
    return <SplashScreen />;
  }

  if (appLockStorageError) {
    return <AppLockStorageError onRetry={() => void reloadAppLock()} />;
  }

  return <ThemedStack />;
}

function AppLockStorageError({ onRetry }: { onRetry: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.root, styles.storageError, { backgroundColor: colors.background }]}>
      <AppText variant="title3" align="center">Could not load app lock settings</AppText>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center">
        Mori Pay could not securely read the app lock setting. Retry before continuing.
      </AppText>
      <PrimaryButton label="Retry" block onPress={onRetry} />
    </View>
  );
}

function SplashScreen() {
  return (
    <View style={[styles.root, styles.splash, { backgroundColor: '#07162E' }]}>
      <StatusBar style="light" />
      <View style={styles.splashOrbTop} />
      <View style={styles.splashOrbBottom} />
      <View style={styles.splashContent}>
        <View style={styles.splashHalo}>
          <View style={styles.splashLogoTile}>
            <Image source={appLogo} resizeMode="contain" style={styles.splashLogo} />
          </View>
        </View>
        <AppText variant="display" style={styles.splashTitle}>{APP.name}</AppText>
        <AppText variant="body" color="rgba(255,255,255,0.76)" align="center">
          Move money simply and securely.
        </AppText>
        <View style={styles.splashAccent} />
      </View>
      <View style={styles.splashLoading}>
        <ActivityIndicator size="small" color="#00CDEF" />
        <AppText variant="bodySmall" color="rgba(255,255,255,0.64)">
          Getting things ready
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 24,
  },
  splashOrbTop: {
    position: 'absolute',
    top: -155,
    right: -145,
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: 'rgba(39,139,255,0.22)',
    backgroundColor: 'rgba(20,93,205,0.08)',
  },
  splashOrbBottom: {
    position: 'absolute',
    bottom: -225,
    left: -185,
    width: 440,
    height: 440,
    borderRadius: 220,
    borderWidth: 1,
    borderColor: 'rgba(0,205,239,0.16)',
    backgroundColor: 'rgba(0,123,202,0.06)',
  },
  splashContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashHalo: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(77,155,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(16,91,201,0.13)',
  },
  splashLogoTile: {
    width: 112,
    height: 112,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: { width: 106, height: 106 },
  splashTitle: { color: '#FFFFFF', letterSpacing: 0.4 },
  splashAccent: {
    marginTop: 12,
    width: 52,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00CDEF',
  },
  splashLoading: {
    position: 'absolute',
    bottom: 54,
    alignItems: 'center',
    gap: 12,
  },
  storageError: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
});
