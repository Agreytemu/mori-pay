import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { spacing } from '@/theme';

export type SettingsGroupProps = {
  /** Section label rendered above the card. */
  title?: string;
  /** Helper copy under the section label. */
  subtitle?: string;
  children: ReactNode;
};

/** Titled card that groups related settings rows. */
export function SettingsGroup({ title, subtitle, children }: SettingsGroupProps) {
  return (
    <View style={styles.root}>
      {title ? (
        <View style={styles.header}>
          <AppText variant="overline" tone="secondary">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" tone="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <Card variant="plain">{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  header: {
    gap: 2,
    paddingHorizontal: spacing.xs,
  },
});
