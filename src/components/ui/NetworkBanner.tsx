import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Network from 'expo-network';

import { AppText } from '@/components/ui/AppText';
import { NoInternetIllustration } from '@/components/ui/NoInternetIllustration';
import { useAppTheme } from '@/theme';

type NetworkState = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
};

export function NetworkBanner() {
  const { colors } = useAppTheme();
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: true,
  });

  useEffect(() => {
    let active = true;

    const update = async () => {
      try {
        const current = await Network.getNetworkStateAsync();
        if (!active) return;
        setState({
          isConnected: current.isConnected ?? true,
          isInternetReachable: current.isInternetReachable ?? null,
        });
      } catch {
        if (active) setState({ isConnected: true, isInternetReachable: true });
      }
    };

    void update();
    const subscription = Network.addNetworkStateListener((current) => {
      if (!active) return;
      setState({
        isConnected: current.isConnected ?? true,
        isInternetReachable: current.isInternetReachable ?? null,
      });
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const offline = !state.isConnected || state.isInternetReachable === false;
  if (!offline) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.error }]}>
      <NoInternetIllustration size={72} />
      <AppText variant="bodySmall" color={colors.textInverse} style={styles.text}>
        You are not connected to internet
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
    fontWeight: '600',
  },
});
