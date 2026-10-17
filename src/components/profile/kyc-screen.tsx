import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  KYC_DOCUMENT_TYPES,
  KYC_DOCUMENT_TYPE_LABELS,
  type KycDocumentType,
  type KycOverview,
} from '@mori-pay/contracts';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import {
  ProfileField,
  ProfileSection,
  StatusBanner,
} from '@/components/profile/profile-components';
import { getKycOverview, submitKyc } from '@/lib/mori-api';
import { spacing, useAppTheme } from '@/theme';
import { formatDate } from '@/utils/format';

/** Mirrors the server-side cap (~5 MB of binary data once decoded). */
const MAX_IMAGE_CHARS = 6_800_000;

const DOCUMENT_NUMBER_LABEL: Record<KycDocumentType, string> = {
  nida: 'NIDA number',
  passport: 'Passport number',
  voters_card: "Voter's card number",
};

const DOCUMENT_NUMBER_HINT: Record<KycDocumentType, string> = {
  nida: 'The 20-digit number printed on your national ID.',
  passport: 'The number shown on the photo page of your passport.',
  voters_card: "The number printed on your voter's registration card.",
};

type PickedImage = { uri: string; dataUrl: string };

function Screen({ header, children }: { header: ReactNode; children: ReactNode }) {
  const { colors, space } = useAppTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { padding: space.lg, gap: space.lg }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DocumentTypeOption({
  type,
  selected,
  onSelect,
}: {
  type: KycDocumentType;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors, radius: themeRadius } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={KYC_DOCUMENT_TYPE_LABELS[type]}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.typeRow,
        {
          borderRadius: themeRadius.md,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
        },
      ]}>
      <AppText variant="body" style={styles.typeLabel}>
        {KYC_DOCUMENT_TYPE_LABELS[type]}
      </AppText>
      <AppIcon
        name={selected ? 'success' : 'check'}
        size={20}
        color={selected ? colors.primary : 'transparent'}
        weight="semibold"
      />
    </Pressable>
  );
}

export function KycScreen() {
  const router = useRouter();
  const { colors, radius: themeRadius } = useAppTheme();

  const [overview, setOverview] = useState<KycOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [documentType, setDocumentType] = useState<KycDocumentType>('nida');
  const [documentNumber, setDocumentNumber] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getKycOverview();
      setOverview(next);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load your verification status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    getKycOverview()
      .then((next) => {
        if (active) {
          setOverview(next);
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : 'Could not load your verification status.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const applyPickerResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.base64) {
      Alert.alert('Could not read that image', 'Please choose or capture a different photo.');
      return;
    }
    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
    if (dataUrl.length > MAX_IMAGE_CHARS) {
      Alert.alert(
        'Image is too large',
        'Choose a smaller photo (under 5 MB) so the upload can complete.',
      );
      return;
    }
    setSubmitError(null);
    setImage({ uri: asset.uri, dataUrl });
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access to upload a picture of your ID.',
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    applyPickerResult(result);
  };

  const capturePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to photograph your ID.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    applyPickerResult(result);
  };

  const submit = async () => {
    setSubmitError(null);
    const number = documentNumber.trim();
    if (number.length < 4) {
      setSubmitError('Enter your ID number.');
      return;
    }
    if (!image) {
      setSubmitError('Add a clear photo of your ID.');
      return;
    }
    setSubmitting(true);
    try {
      const next = await submitKyc({
        documentType,
        documentNumber: number,
        documentImage: image.dataUrl,
      });
      setOverview(next);
      setImage(null);
      setDocumentNumber('');
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Could not submit your verification. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const status = overview?.status ?? null;
  const verified = overview?.tier === 'Verified';
  const showForm = !verified && status !== 'pending';

  return (
    <Screen
      header={
        <ScreenHeader
          title="Verify identity"
          subtitle="Confirm who you are to unlock higher limits"
          onBack={() => router.back()}
        />
      }>
      {loadError ? (
        <StatusBanner tone="error" title="Could not load status" message={loadError} onDismiss={() => void reload()} />
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!loading && verified ? (
        <StatusBanner
          tone="success"
          title="Your identity is verified"
          message="Your account has full access. You can deposit, withdraw and transact up to the verified limits."
        />
      ) : null}

      {!loading && !verified && status === 'pending' && overview?.latest ? (
        <ProfileSection title="Verification under review">
          <View style={styles.detailBlock}>
            <StatusBanner
              tone="info"
              title="We are reviewing your details"
              message="This usually takes less than a day. We will notify you once a decision is made."
            />
            <View style={styles.detailRow}>
              <AppText variant="caption" color={colors.textSecondary}>
                Document
              </AppText>
              <AppText variant="bodySmallStrong">
                {KYC_DOCUMENT_TYPE_LABELS[overview.latest.documentType]}
              </AppText>
            </View>
            <View style={styles.detailRow}>
              <AppText variant="caption" color={colors.textSecondary}>
                Number
              </AppText>
              <AppText variant="bodySmallStrong">
                ···· {overview.latest.documentNumberLast4}
              </AppText>
            </View>
            <View style={styles.detailRow}>
              <AppText variant="caption" color={colors.textSecondary}>
                Submitted
              </AppText>
              <AppText variant="bodySmallStrong">
                {formatDate(overview.latest.submittedAt)}
              </AppText>
            </View>
          </View>
        </ProfileSection>
      ) : null}

      {!loading && !verified && status === 'rejected' && overview?.latest ? (
        <StatusBanner
          tone="error"
          title="Your last submission was rejected"
          message={overview.latest.rejectionReason ?? 'Please review your details and submit again.'}
        />
      ) : null}

      {!loading && showForm ? (
        <>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Choose the ID you will upload, enter its number exactly as printed, then add a clear
            photo. We review it manually to confirm your identity.
          </AppText>

          <ProfileSection title="Document type">
            <View style={styles.typeList}>
              {KYC_DOCUMENT_TYPES.map((type) => (
                <DocumentTypeOption
                  key={type}
                  type={type}
                  selected={documentType === type}
                  onSelect={() => setDocumentType(type)}
                />
              ))}
            </View>
          </ProfileSection>

          <ProfileSection title="Document details">
            <ProfileField
              label={DOCUMENT_NUMBER_LABEL[documentType]}
              hint={DOCUMENT_NUMBER_HINT[documentType]}
              value={documentNumber}
              onChangeText={setDocumentNumber}
              placeholder={DOCUMENT_NUMBER_LABEL[documentType]}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={40}
            />
          </ProfileSection>

          <ProfileSection title="Document photo">
            {image ? (
              <View style={styles.photoBlock}>
                <Image
                  source={{ uri: image.uri }}
                  style={[styles.photo, { borderRadius: themeRadius.md, borderColor: colors.border }]}
                  contentFit="cover"
                />
                <View style={styles.photoActions}>
                  <SecondaryButton
                    label="Replace"
                    icon="gallery"
                    size="sm"
                    onPress={() => void pickFromLibrary()}
                  />
                  <SecondaryButton
                    label="Remove"
                    icon="trash"
                    size="sm"
                    onPress={() => setImage(null)}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.photoBlock}>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  Take a photo in good light, or upload one from your gallery. Make sure every
                  corner and detail is readable and nothing is covered.
                </AppText>
                <View style={styles.photoActions}>
                  <SecondaryButton
                    label="Take photo"
                    icon="camera"
                    size="sm"
                    onPress={() => void capturePhoto()}
                  />
                  <SecondaryButton
                    label="Upload"
                    icon="gallery"
                    size="sm"
                    onPress={() => void pickFromLibrary()}
                  />
                </View>
              </View>
            )}
          </ProfileSection>

          {submitError ? (
            <StatusBanner
              tone="error"
              title="Could not submit"
              message={submitError}
              onDismiss={() => setSubmitError(null)}
            />
          ) : null}

          <PrimaryButton label="Submit for review" loading={submitting} block onPress={() => void submit()} />

          <AppText variant="caption" color={colors.textTertiary}>
            Your details are encrypted and only visible to our verification team.
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  center: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  typeList: {
    gap: spacing.sm,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
  },
  typeLabel: {
    flexShrink: 1,
  },
  detailBlock: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  photoBlock: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  photo: {
    width: '100%',
    height: 200,
    borderWidth: 1,
  },
  photoActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
