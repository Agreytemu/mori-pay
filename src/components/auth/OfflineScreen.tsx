import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/button';
import { ProvidedNoInternetIllustration } from '@/components/ui/ProvidedNoInternetIllustration';
import { useAppTheme } from '@/theme';

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ProvidedNoInternetIllustration size={240} />
      <AppText variant="title2" align="center">
        You are not connected to internet
      </AppText>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center" style={styles.message}>
        Check your connection and try again. Some features need internet access.
      </AppText>
      <PrimaryButton label="Try again" block onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  message: {
    maxWidth: 320,
  },
});
