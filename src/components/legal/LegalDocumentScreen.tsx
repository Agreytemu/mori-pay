import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenContainer } from '@/components/ui/screen';
import { APP } from '@/constants/app';
import { useAppTheme } from '@/theme';

export type LegalDocument = {
  title: string;
  updated: string;
  sections: readonly { heading: string; paragraphs: readonly string[] }[];
};

export function LegalDocumentScreen({
  document,
  relatedPath,
  relatedLabel,
}: {
  document: LegalDocument;
  relatedPath: '/terms-of-service' | '/privacy-policy';
  relatedLabel: string;
}) {
  const router = useRouter();
  const { colors, space } = useAppTheme();

  return (
    <ScreenContainer
      header={
        <ScreenHeader
          title={document.title}
          subtitle={APP.name}
          onBack={() => router.back()}
        />
      }
      contentStyle={{ gap: space.lg }}>
      <AppText variant="caption" color={colors.textTertiary}>
        Last updated {document.updated}
      </AppText>

      {document.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <AppText variant="title3">{section.heading}</AppText>
          {section.paragraphs.map((paragraph, index) => (
            <AppText key={`${section.heading}-${index}`} variant="body" color={colors.textSecondary}>
              {paragraph}
            </AppText>
          ))}
        </View>
      ))}

      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(relatedPath)}
        style={styles.relatedLink}>
        <AppText variant="bodySmallStrong" color={colors.primary}>
          Read our {relatedLabel}
        </AppText>
      </Pressable>

      <AppText variant="caption" color={colors.textTertiary}>
        Questions? Contact {APP.supportEmail}.
      </AppText>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  relatedLink: { alignSelf: 'flex-start', paddingVertical: 8 },
});
