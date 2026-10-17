import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { AppLockPrompt } from '@/components/auth/AppLockPrompt';
import { TransactionNotificationObserver } from '@/components/notifications/TransactionNotificationObserver';
import { OnboardingScreen } from '@/components/onboarding/OnboardingScreen';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { APP } from '@/constants/app';
import { SessionProvider, useSession } from '@/lib/session';
import '@/lib/transaction-notifications';
import { ThemeProvider, useAppTheme } from '@/theme';

const appLogo = require('../../assets/images/brand-mark.png');
const interFonts = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};
const MINIMUM_SPLASH_DURATION_MS = 5_000;
const ONBOARDING_COMPLETE_KEY = 'mori.onboardingComplete';

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
  const [minimumSplashElapsed, setMinimumSplashElapsed] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(
      () => setMinimumSplashElapsed(true),
      MINIMUM_SPLASH_DURATION_MS,
    );
    return () => clearTimeout(timeout);
  }, []);

  if (continueWithoutFonts) {
    return (
      <SessionProvider>
        <GuardedStack minimumSplashElapsed={minimumSplashElapsed} />
      </SessionProvider>
    );
  }

  return (
    <FontLoadAttempt
      key={attempt}
      minimumSplashElapsed={minimumSplashElapsed}
      onRetry={() => setAttempt((current) => current + 1)}
      onContinue={() => setContinueWithoutFonts(true)}
    />
  );
}

function FontLoadAttempt({
  onRetry,
  onContinue,
  minimumSplashElapsed,
}: {
  onRetry: () => void;
  onContinue: () => void;
  minimumSplashElapsed: boolean;
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
      <GuardedStack minimumSplashElapsed={minimumSplashElapsed} />
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
      <TransactionNotificationObserver />
    </View>
  );
}

/** Redirects between the auth flow and the app based on session state. */
function useAuthGuard(onboardingComplete: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const { status, pin } = useSession();

  const inAuthGroup = segments[0] === '(auth)';
  const inLegalDocument =
    inAuthGroup &&
    (segments[1] === 'terms-of-service' || segments[1] === 'privacy-policy');

  useEffect(() => {
    if (status === 'loading' || !onboardingComplete) return;

    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (status === 'authenticated' && inAuthGroup && !inLegalDocument && pin?.pinSet) {
      router.replace('/(tabs)');
    }
  }, [status, onboardingComplete, inAuthGroup, inLegalDocument, pin?.pinSet, router]);
}

function GuardedStack({ minimumSplashElapsed }: { minimumSplashElapsed: boolean }) {
  const { status, appLockReady, appLockStorageError, reloadAppLock } = useSession();
  const [onboardingStatus, setOnboardingStatus] = useState<
    'loading' | 'needed' | 'complete' | 'error'
  >('loading');
  const [onboardingAttempt, setOnboardingAttempt] = useState(0);
  useAuthGuard(onboardingStatus === 'complete');

  useEffect(() => {
    let cancelled = false;
    const loadOnboardingStatus = async () => {
      try {
        const saved = Platform.OS === 'web'
          ? globalThis.localStorage.getItem(ONBOARDING_COMPLETE_KEY)
          : await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
        if (!cancelled) {
          setOnboardingStatus(saved === 'true' ? 'complete' : 'needed');
        }
      } catch (error) {
        console.error('Mori Pay could not read onboarding status.', error);
        if (!cancelled) setOnboardingStatus('error');
      }
    };
    void loadOnboardingStatus();
    return () => {
      cancelled = true;
    };
  }, [onboardingAttempt]);

  const completeOnboarding = async () => {
    try {
      if (Platform.OS === 'web') {
        globalThis.localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      } else {
        await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, 'true');
      }
      setOnboardingStatus('complete');
    } catch (error) {
      console.error('Mori Pay could not save onboarding status.', error);
      setOnboardingStatus('error');
    }
  };

  if (
    !minimumSplashElapsed ||
    status === 'loading' ||
    !appLockReady ||
    onboardingStatus === 'loading'
  ) {
    return <SplashScreen />;
  }

  if (appLockStorageError) {
    return <AppLockStorageError onRetry={() => void reloadAppLock()} />;
  }

  if (onboardingStatus === 'error') {
    return (
      <OnboardingStorageError
        onRetry={() => {
          setOnboardingStatus('loading');
          setOnboardingAttempt((attempt) => attempt + 1);
        }}
        onContinue={() => setOnboardingStatus('complete')}
      />
    );
  }

  if (onboardingStatus === 'needed') {
    return <OnboardingScreen onComplete={completeOnboarding} />;
  }

  return <ThemedStack />;
}

function OnboardingStorageError({
  onRetry,
  onContinue,
}: {
  onRetry: () => void;
  onContinue: () => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.root, styles.storageError, { backgroundColor: colors.background }]}>
      <AppText variant="title3" align="center">Could not save your progress</AppText>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center">
        Try again or continue now. The introduction may appear again the next time you open the app.
      </AppText>
      <PrimaryButton label="Try again" block onPress={onRetry} />
      <SecondaryButton label="Continue without saving" block onPress={onContinue} />
    </View>
  );
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const haloSize = Math.min(180, Math.max(132, width - 140), height * 0.24);

  return (
    <View style={[styles.root, styles.splash, { backgroundColor: '#07162E' }]}>
      <StatusBar style="light" />
      <View style={styles.splashOrbTop} />
      <View style={styles.splashOrbBottom} />
      <View style={styles.splashContent}>
        <View style={[styles.splashHalo, { width: haloSize, height: haloSize, borderRadius: haloSize / 2 }]}>
          <View style={styles.splashLogoTile}>
            <Image source={appLogo} resizeMode="contain" style={styles.splashLogo} />
          </View>
        </View>
        <AppText variant="display" style={[styles.splashTitle, { maxWidth: width - 48 }]}>
          {APP.name}
        </AppText>
        <AppText
          variant="body"
          color="rgba(255,255,255,0.76)"
          align="center"
          style={[styles.splashSubtitle, { maxWidth: width - 48 }]}>
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
      <AppText
        variant="caption"
        color="rgba(255,255,255,0.48)"
        align="center"
        style={[styles.splashCredit, { bottom: Math.max(insets.bottom, 8) + 10 }]}>
        by agreytemu
      </AppText>
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
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  splashHalo: {
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
  splashTitle: {
    color: '#FFFFFF',
    letterSpacing: 0.4,
    textAlign: 'center',
    flexShrink: 1,
  },
  splashSubtitle: { width: '100%', textAlign: 'center', flexShrink: 1 },
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
  splashCredit: { position: 'absolute', alignSelf: 'center' },
  storageError: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
});
