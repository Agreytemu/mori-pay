import { useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SearchField } from '@/components/ui/search-field';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import {
  ConfirmationDialog,
  DeviceCard,
  FaqItem,
  PinDots,
  PinKeypad,
  ProfileField,
  ProfileHeader,
  ProfileMenuItem,
  ProfileSection,
  SecurityStatus,
  SettingsToggle,
  StatusBanner,
} from '@/components/profile/profile-components';
import { AccountInfoRow } from '@/components/wallet/wallet-components';
import { ABOUT_COPY, APP } from '@/constants/app';
import {
  APP_LANGUAGES,
  MOCK_FAQS,
  MOCK_LEGAL_SECTIONS,
  MOCK_REPORT_CATEGORIES,
  MOCK_SUPPORT_CATEGORIES,
  type FaqCategory,
  type ReportCategory,
} from '@/data/profile';
import { useProfileState, type EditableProfileFields } from '@/data/profile-store';
import { useSession } from '@/lib/session';
import { changePin, verifyPin } from '@/lib/mori-api';
import { radius, spacing, useAppTheme, type ThemePreference } from '@/theme';
import { formatDate, formatRelativeTime, initialsOf } from '@/utils/format';

const APPEARANCE_OPTIONS: {
  value: ThemePreference;
  label: string;
  description: string;
  icon: 'appearanceSystem' | 'appearanceLight' | 'appearanceDark';
}[] = [
  { value: 'system', label: 'System default', description: 'Follow your device theme', icon: 'appearanceSystem' },
  { value: 'light', label: 'Light', description: 'Always use the light theme', icon: 'appearanceLight' },
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme', icon: 'appearanceDark' },
];

function appearanceLabel(preference: ThemePreference) {
  return APPEARANCE_OPTIONS.find((option) => option.value === preference)?.label ?? 'System default';
}

/* ---------------------------------------------------------------- scaffold */

function Screen({ header, children }: { header: ReactNode; children: ReactNode }) {
  const { colors, space } = useAppTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

function CheckMark({ visible }: { visible: boolean }) {
  const { colors } = useAppTheme();
  if (!visible) return null;
  return <AppIcon name="check" size={18} color={colors.primary} weight="semibold" />;
}

/* ------------------------------------------------------------------ profile */

export function ProfileScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { profile, devices, language, preferences } = useProfileState();
  const { signOut, accountDataError, reloadAccountData } = useSession();
  const { preference } = useAppTheme();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const otherDevices = devices.filter((device) => !device.isCurrent).length;

  return (
    <Screen
      header={
        <ScreenHeader
          title="Profile"
          subtitle={`${profile.tier} · ${APP.name}`}
          right={
            <SecondaryButton
              label="Edit"
              icon="edit"
              size="sm"
              onPress={() => router.push('/account/personal-information')}
            />
          }
        />
      }>
      {accountDataError ? (
        <StatusBanner
          tone="error"
          title="Could not load account data"
          message={accountDataError.message}
          onDismiss={() => void reloadAccountData()}
        />
      ) : null}
      <ProfileHeader profile={profile} />

      <ProfileSection title="Account">
        <ProfileMenuItem
          icon="id"
          label="Personal information"
          description="Name, phone, email and date of birth"
          onPress={() => router.push('/account/personal-information')}
          showDivider
        />
        <ProfileMenuItem
          icon="payments"
          label="Payment methods"
          description="Saved mobile money and cards"
          onPress={() => router.push('/payment-methods')}
          showDivider
        />
        <ProfileMenuItem
          icon="wallet"
          label="Wallet / account"
          description="Balance, deposits and withdrawals"
          onPress={() => router.push('/wallet')}
          showDivider
        />
        <ProfileMenuItem
          icon="notification"
          label="Notifications"
          description="Payment, transaction and security alerts"
          onPress={() => router.push('/notifications')}
        />
      </ProfileSection>

      <ProfileSection title="Security">
        <ProfileMenuItem
          icon="security"
          label="Security"
          description="Protection status and activity"
          onPress={() => router.push('/account/security')}
          showDivider
        />
        <ProfileMenuItem
          icon="pin"
          label="Change PIN"
          description="Update your 6-digit PIN"
          onPress={() => router.push('/account/change-pin')}
          showDivider
        />
        <SettingsToggle
          icon="biometrics"
          label="Biometric authentication"
          description="Biometric sign-in is not available yet."
          value={false}
          disabled
          onValueChange={() => {}}
          showDivider
        />
        <ProfileMenuItem
          icon="devices"
          label="Trusted devices"
          description={
            otherDevices === 0
              ? 'Only this device is signed in'
              : `${otherDevices} other device${otherDevices === 1 ? '' : 's'} signed in`
          }
          onPress={() => router.push('/account/trusted-devices')}
        />
      </ProfileSection>

      <ProfileSection title="Preferences">
        <ProfileMenuItem
          icon="appearance"
          label="Settings"
          description="Appearance, language and notifications"
          onPress={() => router.push('/account/settings')}
          showDivider
        />
        <ProfileMenuItem
          icon="appearanceLight"
          label="Appearance"
          value={appearanceLabel(preference)}
          onPress={() => router.push('/account/settings')}
          showDivider
        />
        <ProfileMenuItem
          icon="language"
          label="Language"
          value={APP_LANGUAGES[language]}
          onPress={() => router.push('/account/settings')}
          showDivider
        />
        <ProfileMenuItem
          icon="notificationsSetting"
          label="Notification preferences"
          description={`${Object.values(preferences).filter(Boolean).length} of ${Object.keys(preferences).length} alerts on`}
          onPress={() => router.push('/account/settings')}
        />
      </ProfileSection>

      <ProfileSection title="Support">
        <ProfileMenuItem
          icon="help"
          label="Help & support"
          description="Answers to common questions"
          onPress={() => router.push('/account/help')}
          showDivider
        />
        <ProfileMenuItem
          icon="phone"
          label="Contact support"
          description={`${APP.supportPhone} · ${APP.supportEmail}`}
          onPress={() => router.push('/account/help')}
          showDivider
        />
        <ProfileMenuItem
          icon="info"
          label="FAQs"
          description={`${MOCK_FAQS.length} answers across ${MOCK_SUPPORT_CATEGORIES.length} topics`}
          onPress={() => router.push('/account/help')}
          showDivider
        />
        <ProfileMenuItem
          icon="about"
          label={`About ${APP.name}`}
          description={`Version ${APP.version}`}
          onPress={() => router.push('/account/about')}
        />
      </ProfileSection>

      <ProfileSection title="Account actions">
        <ProfileMenuItem
          icon="logout"
          label="Log out"
          description="Sign out of this device"
          tone="destructive"
          onPress={() => setConfirmLogout(true)}
        />
      </ProfileSection>

      <View style={styles.footer}>
        <AppText variant="caption" color={colors.textTertiary} align="center">
          {ABOUT_COPY.legal}
        </AppText>
        <AppText variant="caption" color={colors.textTertiary} align="center">
          Version {APP.version} · {APP.buildLabel}
        </AppText>
      </View>

      <ConfirmationDialog
        visible={confirmLogout}
        title="Log out?"
        message={`You will be signed out of ${APP.name} on this device. You need your PIN to sign back in.`}
        confirmLabel="Log out"
        destructive
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          void (async () => {
            await signOut();
            setSignedOut(true);
          })();
        }}
      />

      <ConfirmationDialog
        visible={signedOut}
        title="Signed out"
        message="You have been signed out of this device. Sign in again with your mobile number when you need to use the app."
        confirmLabel="Close"
        onClose={() => setSignedOut(false)}
        onConfirm={() => setSignedOut(false)}
      />
    </Screen>
  );
}

/* --------------------------------------------------- personal information */

type ProfileErrors = Partial<Record<keyof EditableProfileFields, string>>;

function validateProfile(draft: EditableProfileFields): ProfileErrors {
  const errors: ProfileErrors = {};
  const name = draft.fullName.trim();

  if (name.length < 3) errors.fullName = 'Enter your full name as it appears on your ID.';
  else if (!/[a-z]/i.test(name)) errors.fullName = 'Name must contain letters.';

  const digits = draft.phone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    errors.phone = 'Enter a valid phone number, e.g. +255712345678.';
  }

  if (draft.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(draft.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  const dateOfBirth = draft.dateOfBirth.trim();
  const match = dateOfBirth ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth) : null;
  if (dateOfBirth && !match) {
    errors.dateOfBirth = 'Use the format YYYY-MM-DD.';
  } else if (match) {
    const [, year, month, day] = match;
    const birth = new Date(Number(year), Number(month) - 1, Number(day));
    const isRealDate =
      birth.getFullYear() === Number(year) &&
      birth.getMonth() === Number(month) - 1 &&
      birth.getDate() === Number(day);
    if (!isRealDate) {
      errors.dateOfBirth = 'That date does not exist.';
    } else {
      const age = (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 18) errors.dateOfBirth = 'You must be at least 18 years old.';
      else if (age > 120) errors.dateOfBirth = 'Check the year — that looks too far back.';
    }
  }

  return errors;
}

export function PersonalInformationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { updateProfile } = useSession();
  const { profile } = useProfileState();

  const [editing, setEditing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draft, setDraft] = useState<EditableProfileFields>({
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    dateOfBirth: profile.dateOfBirth,
  });

  const profileDraft: EditableProfileFields = {
    fullName: profile.fullName,
    phone: profile.phone,
    email: profile.email,
    dateOfBirth: profile.dateOfBirth,
  };
  const currentDraft = draftDirty ? draft : profileDraft;
  const errors = useMemo(() => validateProfile(currentDraft), [currentDraft]);
  const hasErrors = Object.keys(errors).length > 0;

  const update = (key: keyof EditableProfileFields) => (value: string) => {
    setDraft((current) => ({ ...(draftDirty ? current : profileDraft), [key]: value }));
    setDraftDirty(true);
  };

  const cancel = () => {
    setDraft({
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      dateOfBirth: profile.dateOfBirth,
    });
    setSubmitted(false);
    setDraftDirty(false);
    setEditing(false);
  };

  const save = async () => {
    setSubmitted(true);
    if (hasErrors) return;
    setBusy(true);
    setSaveError(null);
    try {
      await updateProfile({
        fullName: currentDraft.fullName.trim(),
        email: currentDraft.email.trim() || null,
        dateOfBirth: currentDraft.dateOfBirth.trim() || null,
      });
      setDraftDirty(false);
      setEditing(false);
      setSubmitted(false);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save profile changes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        <ScreenHeader
          title="Personal information"
          subtitle={profile.memberId}
          onBack={() => router.back()}
          right={
            editing ? undefined : (
              <SecondaryButton label="Edit" icon="edit" size="sm" onPress={() => setEditing(true)} />
            )
          }
        />
      }>
      {saved ? (
        <StatusBanner
          tone="success"
          title="Profile updated"
          message="Your profile changes were saved to your account."
          onDismiss={() => setSaved(false)}
        />
      ) : null}
      {saveError ? <StatusBanner tone="error" title="Could not save profile" message={saveError} /> : null}

      {!editing ? (
        <>
          <ProfileHeader profile={profile} />

          <View
            style={[
              styles.card,
              { borderRadius: radius.lg, backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
            <AccountInfoRow label="Full name" value={profile.fullName} />
            <AccountInfoRow label="Phone number" value={profile.phone} />
            <AccountInfoRow label="Email" value={profile.email} />
            <AccountInfoRow label="Date of birth" value={formatDate(profile.dateOfBirth)} />
            <AccountInfoRow
              label="Account status"
              value={profile.status === 'verified' ? 'Verified' : profile.status}
            />
            <AccountInfoRow label="Member ID" value={profile.memberId} />
            <AccountInfoRow label="Member since" value={formatDate(profile.joinedAt)} last />
          </View>

          <PrimaryButton
            label="Edit information"
            icon="edit"
            block
            onPress={() => setEditing(true)}
          />

          <AppText variant="caption" color={colors.textTertiary}>
            Your mobile number is verified and cannot be changed here. Contact support if it needs to be updated.
          </AppText>
        </>
      ) : (
        <>
          <View style={styles.form}>
            <ProfileField
              label="Full name"
              value={currentDraft.fullName}
              onChangeText={update('fullName')}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Agrey Temu"
              error={submitted ? errors.fullName : undefined}
            />
            <ProfileField
              label="Phone number"
              value={currentDraft.phone}
              onChangeText={update('phone')}
              editable={false}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+255712345678"
              hint="Include the country code."
              error={submitted ? errors.phone : undefined}
            />
            <ProfileField
              label="Email"
              value={currentDraft.email}
              onChangeText={update('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@example.co.tz"
              error={submitted ? errors.email : undefined}
            />
            <ProfileField
              label="Date of birth"
              value={currentDraft.dateOfBirth}
              onChangeText={update('dateOfBirth')}
              keyboardType="numbers-and-punctuation"
              placeholder="1996-04-18"
              hint="Format: YYYY-MM-DD"
              error={submitted ? errors.dateOfBirth : undefined}
            />
          </View>

          {submitted && hasErrors ? (
            <StatusBanner
              tone="error"
              title="Check the highlighted fields"
              message="Fix the details above, then save again."
            />
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton label="Save changes" block loading={busy} disabled={submitted && hasErrors} onPress={() => void save()} />
            <SecondaryButton label="Cancel" block onPress={cancel} />
          </View>
        </>
      )}
    </Screen>
  );
}

/* ---------------------------------------------------------------- security */

export function SecurityScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { security, devices, pinUpdatedAt } = useProfileState();
  const { updateNotificationPreferences } = useSession();
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const protections = [
    security.biometricsEnabled ? 'Biometrics on' : 'Biometrics off',
    security.loginAlertsEnabled ? 'Security alerts on' : 'Security alerts off',
    'PIN protected',
  ];

  const otherDevices = devices.filter((device) => !device.isCurrent).length;

  return (
    <Screen header={<ScreenHeader title="Security" subtitle="Protection and devices" onBack={() => router.back()} />}>
      <SecurityStatus status={security.status} protections={protections} lastCheckedAt={security.lastCheckedAt} />

      <ProfileSection title="Account protection">
        <ProfileMenuItem
          icon="pin"
          label="Change PIN"
          description={
            pinUpdatedAt
              ? `Last changed ${formatRelativeTime(pinUpdatedAt)}`
              : 'Four digits, required for payments and cash out'
          }
          onPress={() => router.push('/account/change-pin')}
          showDivider
        />
        <ProfileMenuItem
          icon="devices"
          label="Trusted devices"
          description={
            otherDevices === 0
              ? 'Only this device is signed in'
              : `${otherDevices} other device${otherDevices === 1 ? '' : 's'} signed in`
          }
          onPress={() => router.push('/account/trusted-devices')}
        />
      </ProfileSection>

      <ProfileSection title="Alerts">
        {preferenceError ? (
          <AppText variant="caption" color={colors.error}>{preferenceError}</AppText>
        ) : null}
        <SettingsToggle
          icon="notification"
          label="Login and security alerts"
          description="Get notified when a new device signs in or your PIN changes"
          value={security.loginAlertsEnabled}
          onValueChange={(value) => {
            setPreferenceError(null);
            void updateNotificationPreferences({ securityAlerts: value }).catch((error: unknown) =>
              setPreferenceError(error instanceof Error ? error.message : 'Could not save notification preferences.')
            );
          }}
        />
      </ProfileSection>

      <ProfileSection title="PIN">
        <ProfileMenuItem
          icon="pin"
          label="PIN protection"
          value={pinUpdatedAt ? 'Set' : 'Not set'}
          description={
            pinUpdatedAt
              ? `Last updated ${formatRelativeTime(pinUpdatedAt)}`
              : 'Set a PIN to protect payments and withdrawals.'
          }
        />
      </ProfileSection>

      <AppText variant="caption" color={colors.textTertiary}>
        Security activity history is not available yet.
      </AppText>
    </Screen>
  );
}

/* -------------------------------------------------------------- change pin */

const PIN_LENGTH = 6;
const SEQUENTIAL_PINS = ['012345', '123456', '234567', '345678', '456789', '987654', '876543', '654321', '765432']; 
const REPEATED_RE = new RegExp(`^(\\d)\\1{${PIN_LENGTH - 1}}$`);

type PinStep = 'current' | 'new' | 'confirm' | 'success';

const PIN_STEPS: Record<Exclude<PinStep, 'success'>, { eyebrow: string; title: string; hint: string }> = {
  current: {
    eyebrow: 'STEP 1 OF 3',
    title: 'Enter your current PIN',
    hint: 'Six digits. Your current PIN is required to continue.',
  },
  new: {
    eyebrow: 'STEP 2 OF 3',
    title: 'Choose a new PIN',
    hint: 'Avoid repeated digits like 111111 and sequences like 123456.',
  },
  confirm: {
    eyebrow: 'STEP 3 OF 3',
    title: 'Confirm your new PIN',
    hint: 'Enter the same six digits again.',
  },
};

export function ChangePinScreen() {
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const { setPin: pushPinStatus } = useSession();
  const [step, setStep] = useState<PinStep>('current');
  const [entry, setEntry] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const submit = async (pin: string) => {
    if (step === 'current') {
      setBusy(true);
      setError(null);
      try {
        await verifyPin({ pin });
        setCurrentPin(pin);
        setStep('new');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Incorrect PIN.');
      } finally {
        setBusy(false);
        setEntry('');
      }
      return;
    }

    if (step === 'new') {
      if (pin === currentPin) {
        setError('Your new PIN must be different from the current one.');
        setEntry('');
        return;
      }
      if (REPEATED_RE.test(pin) || SEQUENTIAL_PINS.includes(pin)) {
        setError('That PIN is too easy to guess. Pick a less obvious combination.');
        setEntry('');
        return;
      }
      setNewPin(pin);
      setStep('confirm');
      setError(null);
      setEntry('');
      return;
    }

    if (pin !== newPin) {
      setError('The PINs do not match. Start the last step again.');
      setEntry('');
      return;
    }

    setBusy(true);
    setError(null);
    setEntry('');
    try {
      const status = await changePin({ currentPin, newPin: pin });
      pushPinStatus(status);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your PIN.');
      setStep('current');
      setCurrentPin('');
      setNewPin('');
    } finally {
      setBusy(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (busy || entry.length >= PIN_LENGTH || step === 'success') return;
    const next = entry + digit;
    setEntry(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  const copy = step === 'success' ? null : PIN_STEPS[step];

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.flex, { padding: spacing.lg, gap: spacing.lg }]}>
        <ScreenHeader
          title="Change PIN"
          subtitle="Payments and cash out are protected by your PIN"
          onBack={() => router.back()}
          right={
            step === 'success' ? undefined : (
              <SecondaryButton
                label={revealed ? 'Hide' : 'Show'}
                icon={revealed ? 'eyeOff' : 'eye'}
                size="sm"
                onPress={() => setRevealed((value) => !value)}
              />
            )
          }
        />

        {step === 'success' ? (
          <View style={styles.pinSuccess}>
            <View style={[styles.successIcon, { borderRadius: radius.xl, backgroundColor: colors.successSoft }]}>
              <AppIcon name="success" size={34} color={colors.success} weight="semibold" />
            </View>
            <AppText variant="title2" align="center">
              PIN updated
            </AppText>
            <AppText variant="bodySmall" color={colors.textSecondary} align="center">
              Your new PIN is active. You will use it to pay and to cash out.
            </AppText>
            <PrimaryButton label="Done" block onPress={() => router.back()} />
          </View>
        ) : (
          <>
            <View style={styles.pinStep}>
              <AppText variant="overline" color={colors.textTertiary}>
                {copy?.eyebrow}
              </AppText>
              <AppText variant="title3">{copy?.title}</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary}>
                {copy?.hint}
              </AppText>
              <PinDots length={entry.length} revealed={revealed} />
              {revealed && entry.length > 0 ? (
                <AppText variant="mono" color={colors.textSecondary} align="center">
                  {entry}
                </AppText>
              ) : null}
            </View>

            {error ? (
              <StatusBanner
                tone="error"
                title="Check your PIN"
                message={error}
                onDismiss={() => setError(null)}
              />
            ) : null}

            <View style={styles.keypadHolder}>
              <PinKeypad onDigit={handleDigit} onBackspace={() => setEntry((value) => value.slice(0, -1))} disabled={busy} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

/* ---------------------------------------------------------- trusted devices */

export function TrustedDevicesScreen() {
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const { devices } = useProfileState();
  const { removeDevice } = useSession();
  const [pending, setPending] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Screen header={<ScreenHeader title="Trusted devices" subtitle={`${devices.length} signed in`} onBack={() => router.back()} />}>
      <AppText variant="bodySmall" color={colors.textSecondary}>
        Any device listed here can access your account. Remove anything you do not recognise and change
        your PIN.
      </AppText>

      {devices.length === 0 ? (
        <View
          style={[
            styles.emptyCard,
            { borderRadius: radius.lg, borderColor: colors.border, backgroundColor: colors.surface },
          ]}>
          <AppIcon name="devices" size={28} color={colors.textTertiary} />
          <AppText variant="title3" align="center">
            No devices to show
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} align="center">
            Every other device has been removed from your account.
          </AppText>
        </View>
      ) : (
        <View style={styles.deviceList}>
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onRemove={() => setPending({ id: device.id, name: device.name })}
            />
          ))}
        </View>
      )}

      <AppText variant="caption" color={colors.textTertiary}>
        These signed-in devices are linked to your account.
      </AppText>

      {error ? <StatusBanner tone="error" title="Could not remove device" message={error} /> : null}

      <ConfirmationDialog
        visible={pending !== null}
        title="Remove device?"
        message={`${pending?.name ?? 'This device'} will be signed out. It will need your PIN the next time it signs in.`}
        confirmLabel="Remove device"
        destructive
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (!pending || busy) return;
          setBusy(true);
          setError(null);
          void removeDevice(pending.id)
            .then(() => setPending(null))
            .catch((removeError: unknown) => {
              setError(removeError instanceof Error ? removeError.message : 'Could not remove device.');
            })
            .finally(() => setBusy(false));
        }}
      />
    </Screen>
  );
}

/* ---------------------------------------------------------------- settings */

export function SettingsScreen() {
  const router = useRouter();
  const { preference, setPreference, colors } = useAppTheme();
  const { language, preferences } = useProfileState();
  const { updateNotificationPreferences } = useSession();

  const [preferenceMessage, setPreferenceMessage] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  const saveNotificationPreference = async (
    key: 'payments' | 'transactions' | 'securityAlerts' | 'promotions',
    value: boolean
  ) => {
    setPreferenceMessage(null);
    setPreferenceError(null);
    try {
      if (key === 'payments') {
        await updateNotificationPreferences({ moneyIn: value, moneyOut: value });
      } else if (key === 'transactions') {
        await updateNotificationPreferences({ transactions: value });
      } else if (key === 'securityAlerts') {
        await updateNotificationPreferences({ securityAlerts: value });
      } else {
        await updateNotificationPreferences({ marketing: value });
      }
    } catch (error) {
      setPreferenceError(
        error instanceof Error ? error.message : 'Could not save notification preferences.'
      );
    }
  };

  return (
    <Screen header={<ScreenHeader title="Settings" subtitle="Appearance, language and alerts" onBack={() => router.back()} />}>
      <ProfileSection title="Appearance" subtitle={`Currently ${appearanceLabel(preference).toLowerCase()}`}>
        {APPEARANCE_OPTIONS.map((option, index) => (
          <ProfileMenuItem
            key={option.value}
            icon={option.icon}
            label={option.label}
            description={option.description}
            showDivider={index < APPEARANCE_OPTIONS.length - 1}
            onPress={() => {
              setPreference(option.value);
              setPreferenceMessage(
                option.value === 'system'
                  ? 'Following your device theme.'
                  : `Appearance set to ${option.label.toLowerCase()}.`
              );
            }}
            accessory={<CheckMark visible={preference === option.value} />}
          />
        ))}
      </ProfileSection>

      {preferenceMessage ? (
        <StatusBanner
          tone="info"
          title="Appearance updated"
          message={preferenceMessage}
          onDismiss={() => setPreferenceMessage(null)}
        />
      ) : null}
      {preferenceError ? (
        <StatusBanner
          tone="error"
          title="Could not save settings"
          message={preferenceError}
          onDismiss={() => setPreferenceError(null)}
        />
      ) : null}

      <ProfileSection title="Language" subtitle={APP_LANGUAGES[language]}>
        <ProfileMenuItem
          icon="language"
          label={APP_LANGUAGES.en}
          description="Only English is available in this release."
          accessory={<CheckMark visible={language === 'en'} />}
          disabled
        />
      </ProfileSection>

      <ProfileSection title="Notifications">
        <SettingsToggle
          icon="payments"
          label="Payment notifications"
          description="Sent and received payment alerts"
          value={preferences.payments}
          onValueChange={(value) => void saveNotificationPreference('payments', value)}
          showDivider
        />
        <SettingsToggle
          icon="transactions"
          label="Transaction notifications"
          description="Every movement in your transaction list"
          value={preferences.transactions}
          onValueChange={(value) => void saveNotificationPreference('transactions', value)}
          showDivider
        />
        <SettingsToggle
          icon="security"
          label="Security alerts"
          description="New devices, PIN changes and login attempts"
          value={preferences.securityAlerts}
          onValueChange={(value) => void saveNotificationPreference('securityAlerts', value)}
          showDivider
        />
        <SettingsToggle
          icon="notificationActive"
          label="Promotional notifications"
          description="Product news and offers. Off by default."
          value={preferences.promotions}
          onValueChange={(value) => void saveNotificationPreference('promotions', value)}
        />
      </ProfileSection>

      <ProfileSection title="Other">
        <ProfileMenuItem
          icon="info"
          label="App version"
          value={`v${APP.version}`}
          description={APP.buildLabel}
          showDivider
        />
        <ProfileMenuItem
          icon="security"
          label="Privacy"
          description="What the app stores and shares"
          onPress={() => router.push('/account/about')}
          showDivider
        />
        <ProfileMenuItem
          icon="receipt"
          label="Terms and conditions"
          description={`Terms for using ${APP.name}`}
          onPress={() => router.push('/account/about')}
        />
      </ProfileSection>

      <AppText variant="caption" color={colors.textTertiary}>
        Preferences are kept locally. Changing the theme applies immediately across every screen.
      </AppText>
    </Screen>
  );
}

/* ---------------------------------------------------------- help & support */

export function HelpSupportScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FaqCategory | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<ReportCategory>('payment');
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return MOCK_FAQS.filter((faq) => {
      if (category && faq.category !== category) return false;
      if (!needle) return true;
      return `${faq.question} ${faq.answer}`.toLowerCase().includes(needle);
    });
  }, [query, category]);

  const toggle = (id: string) =>
    setExpanded((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  const faqCount = (id: FaqCategory) => MOCK_FAQS.filter((faq) => faq.category === id).length;

  return (
    <Screen
      header={
        <ScreenHeader
          title="Help & support"
          subtitle="Answers, reports and contact"
          onBack={() => router.back()}
        />
      }>
      <SearchField value={query} onChangeText={setQuery} placeholder="Search help topics" />

      <ProfileSection title="Browse by topic" subtitle={category ? 'Tap again to clear' : undefined}>
        {MOCK_SUPPORT_CATEGORIES.map((item, index) => (
          <ProfileMenuItem
            key={item.id}
            icon={item.icon}
            label={item.title}
            description={item.description}
            value={`${faqCount(item.id)} articles`}
            showDivider={index < MOCK_SUPPORT_CATEGORIES.length - 1}
            onPress={() => setCategory((current) => (current === item.id ? null : item.id))}
            accessory={<CheckMark visible={category === item.id} />}
          />
        ))}
      </ProfileSection>

      <ProfileSection
        title={query || category ? 'Matching articles' : 'Frequently asked questions'}
        subtitle={`${results.length} result${results.length === 1 ? '' : 's'}`}>
        {results.length === 0 ? (
          <View style={styles.faqResultEmpty}>
            <StatusBanner
              tone="info"
              title="No matching topics"
              message="Try a different word, or clear the topic filter."
            />
          </View>
        ) : (
          results.map((faq) => (
            <FaqItem
              key={faq.id}
              question={faq.question}
              answer={faq.answer}
              expanded={expanded.includes(faq.id)}
              onToggle={() => toggle(faq.id)}
            />
          ))
        )}
      </ProfileSection>

      <ProfileSection title="Contact support">
        <ProfileMenuItem icon="phone" label="Phone" value={APP.supportPhone} description="Mon–Fri, 08:00–18:00 EAT" showDivider />
        <ProfileMenuItem icon="email" label="Email" value={APP.supportEmail} description="Replies within one business day" showDivider />
        <ProfileMenuItem
          icon="warning"
          label="Report a problem"
          description="Send the support team a short description"
          onPress={() => setReportOpen((value) => !value)}
          accessory={<CheckMark visible={reportOpen} />}
        />
      </ProfileSection>

      {reportOpen ? (
        <View style={styles.form}>
          {reportSent ? (
            <StatusBanner
              tone="success"
              title="Report received"
              message="Support usually replies within one business day. Nothing was sent in this prototype."
              onDismiss={() => setReportSent(false)}
            />
          ) : null}

          <SegmentedControl
            variant="chips"
            accessibilityLabel="Report category"
            options={MOCK_REPORT_CATEGORIES.map((item) => ({ value: item.id, label: item.label }))}
            value={reportCategory}
            onChange={setReportCategory}
          />

          <ProfileField
            label="What happened?"
            value={reportText}
            onChangeText={setReportText}
            placeholder="Describe the issue, including the amount if it is about a payment"
            multiline
            numberOfLines={4}
            style={styles.multiline}
            hint={`${reportText.trim().length}/400 characters`}
          />

          <PrimaryButton
            label="Submit report"
            block
            disabled={reportText.trim().length === 0}
            onPress={() => {
              setReportSent(true);
              setReportText('');
            }}
          />
        </View>
      ) : null}

      <AppText variant="caption" color={colors.textTertiary}>
        Never share your PIN with anyone, including support staff.
      </AppText>
    </Screen>
  );
}

/* ------------------------------------------------------------------- about */

export function AboutScreen() {
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const [open, setOpen] = useState<string[]>([]);

  return (
    <Screen header={<ScreenHeader title="About" subtitle={APP.name} onBack={() => router.back()} />}>
      <View
        style={[
          styles.aboutBrand,
          { borderRadius: radius.xl, backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        <View style={[styles.aboutMark, { borderRadius: radius.lg, backgroundColor: colors.primarySoft }]}>
          <AppText variant="title1" color={colors.primary}>
            {initialsOf(APP.name)}
          </AppText>
        </View>
        <AppText variant="title2">{APP.name}</AppText>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          {APP.tagline} · {APP.description}
        </AppText>
        <View style={[styles.versionPill, { borderRadius: radius.pill, backgroundColor: colors.surfaceMuted }]}>
          <AppText variant="caption" color={colors.textSecondary}>
            Version {APP.version} · {APP.buildLabel}
          </AppText>
        </View>
      </View>

      <ProfileSection title="Legal">
        {MOCK_LEGAL_SECTIONS.map((section) => (
          <FaqItem
            key={section.id}
            question={section.title}
            answer={section.body}
            expanded={open.includes(section.id)}
            onToggle={() =>
              setOpen((current) =>
                current.includes(section.id)
                  ? current.filter((item) => item !== section.id)
                  : [...current, section.id]
              )
            }
          />
        ))}
      </ProfileSection>

      <ProfileSection title="Support">
        <ProfileMenuItem
          icon="help"
          label="Help & support"
          description="FAQs and contact options"
          onPress={() => router.push('/account/help')}
          showDivider
        />
        <ProfileMenuItem icon="phone" label={APP.supportPhone} description={APP.supportEmail} />
      </ProfileSection>

      <AppText variant="caption" color={colors.textTertiary} align="center">
        {ABOUT_COPY.legal}
      </AppText>
    </Screen>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingBottom: spacing.huge,
  },
  footer: { gap: 4 },
  card: { borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg },
  form: { gap: spacing.lg },
  actions: { gap: spacing.sm },
  deviceList: { gap: spacing.md },
  emptyCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pinStep: { gap: spacing.sm },
  keypadHolder: { marginTop: 'auto', paddingBottom: spacing.sm },
  pinSuccess: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  successIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  faqResultEmpty: { padding: spacing.lg },
  multiline: { minHeight: 104, textAlignVertical: 'top', paddingTop: spacing.md },
  aboutBrand: {
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  aboutMark: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  versionPill: { paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: spacing.xs },
});