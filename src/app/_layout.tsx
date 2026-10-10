import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider, useSession } from '@/lib/session';
import { ThemeProvider, useAppTheme } from '@/theme';

/**
 * Root navigator. Owns the theme, the safe-area context, the session provider
 * and the single screen stack that hosts the tab group and the auth flow.
 */
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <GuardedStack />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
  const { status } = useSession();
  useAuthGuard();

  if (status === 'loading') {
    return <SplashScreen />;
  }

  return <ThemedStack />;
}

function SplashScreen() {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.root, styles.splash, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { alignItems: 'center', justifyContent: 'center' },
});
