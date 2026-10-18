import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import { Image } from 'expo-image';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/button';
import { PaymentMethodSelector } from '@/components/payment/payment-components';
import { PAYMENT_METHOD_TYPES, type SavedPaymentMethod } from '@/data/mock-payment-methods';
import { mobileNetworkLogo } from '@/constants/mobile-network-logos';
import { getTzPhoneInputDigits, normalizeTzPhone } from '@/lib/phone';
import {
  removePaymentMethod,
  savePaymentMethod,
  setPaymentMethodDefault,
  usePaymentMethods,
} from '@/data/payment-method-store';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';
import { getPaymentMethodVisibility, type PaymentMethodVisibility } from '@/lib/mori-api';

type MethodKind = SavedPaymentMethod['kind'];
type MethodFields = { provider: string; personName: string; identifier: string; expiry: string; cvv: string };

const EMPTY_FIELDS: MethodFields = { provider: '', personName: '', identifier: '', expiry: '', cvv: '' };
const PROVIDERS = ['M-Pesa', 'Airtel Money', 'Mixx by Yas', 'HaloPesa'] as const;

function methodIcon(kind: MethodKind) {
  return kind === 'mobile-money' ? 'phone' : 'payments';
}

function kindLabel(kind: MethodKind) {
  return kind === 'mobile-money' ? 'Mobile Money' : kind === 'bank' ? 'Bank Account' : 'Card';
}

function isMethodVisible(visibility: PaymentMethodVisibility, kind: MethodKind) {
  return kind === 'mobile-money'
    ? visibility.mobileMoneyEnabled
    : kind === 'bank'
      ? visibility.bankEnabled
      : visibility.cardEnabled;
}

function Header({ title, subtitle, onBack, right }: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => [
          styles.headerButton,
          { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border, borderRadius: radius.circle },
        ]}>
        <AppIcon name="chevronLeft" size={19} color={colors.text} />
      </Pressable>
      <View style={styles.headerText}>
        <AppText variant="title2">{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.textSecondary}>{subtitle}</AppText> : null}
      </View>
      {right ?? <View style={styles.headerButton} />}
    </View>
  );
}

function MethodTile({ item, onPress }: { item: SavedPaymentMethod; onPress: () => void }) {
  const { colors, radius, space } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${item.identifier}${item.isDefault ? ', default' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.methodTile,
        {
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: space.base,
        },
      ]}>
      <MethodIcon kind={item.kind} provider={item.provider} />
      <View style={styles.methodCopy}>
        <View style={styles.methodTitleRow}>
          <AppText variant="bodyStrong" numberOfLines={1}>{item.name}</AppText>
          {item.isDefault ? (
            <View style={[styles.defaultBadge, { backgroundColor: colors.primarySoft }]}>
              <AppText variant="caption" color={colors.primary}>Default</AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="bodySmall" color={colors.textSecondary} numberOfLines={1}>
          {kindLabel(item.kind)} · {item.identifier}
        </AppText>
      </View>
      <AppIcon name="more" size={19} color={colors.textTertiary} />
    </Pressable>
  );
}

export function PaymentMethodsScreen() {
  const router = useRouter();
  const { methods, loading, error } = usePaymentMethods();
  const { colors, space } = useAppTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: space.base, gap: space.lg }]}
        showsVerticalScrollIndicator={false}>
        <Header title="Payment Methods" subtitle="Manage your saved ways to pay" onBack={() => router.back()} />
        <View style={styles.intro}>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Saved payment details are securely limited to provider information and the last four digits.
          </AppText>
        </View>
        {error ? <AppText variant="bodySmall" color={colors.error}>{error.message}</AppText> : null}
        <View style={styles.sectionHeading}>
          <AppText variant="bodySmallStrong">Saved methods</AppText>
          <AppText variant="caption" color={colors.textTertiary}>{methods.length} {methods.length === 1 ? 'method' : 'methods'}</AppText>
        </View>
        {loading ? (
          <AppText variant="bodySmall" color={colors.textSecondary}>Loading saved methods…</AppText>
        ) : methods.length ? (
          <View style={styles.methodList}>
            {methods.map((item) => (
              <MethodTile
                key={item.id}
                item={item}
                onPress={() => router.push({ pathname: '/payment-methods/[id]', params: { id: item.id } })}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.emptyState, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <AppIllustration name="creditCard" width={176} height={112} />
            <AppText variant="bodyStrong">No payment methods yet</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary} align="center">
              Add a mobile wallet, bank account, or card to get started.
            </AppText>
          </View>
        )}
        <Button label="Add payment method" icon="plus" onPress={() => router.push('/payment-methods/add')} />
      </ScrollView>
    </SafeAreaView>
  );
}

export function PaymentMethodFormScreen({ edit = false }: { edit?: boolean }) {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { methods, loading, error } = usePaymentMethods();
  const original = methods.find((item) => item.id === params.id);
  const [kind, setKind] = useState<MethodKind>(original?.kind ?? 'mobile-money');
  const [fields, setFields] = useState<MethodFields>(() => ({
    ...EMPTY_FIELDS,
    provider: original?.provider ?? '',
    personName: original?.name ?? '',
  }));
  const [isDefault, setIsDefault] = useState(original?.isDefault ?? methods.length === 0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [methodVisibility, setMethodVisibility] =
    useState<PaymentMethodVisibility | null>(null);
  const [visibilityError, setVisibilityError] = useState('');
  const [loadingVisibility, setLoadingVisibility] = useState(!edit);
  const { colors, space } = useAppTheme();

  useEffect(() => {
    if (edit) return;
    let mounted = true;
    void getPaymentMethodVisibility()
      .then((availability) => {
        if (mounted) setMethodVisibility(availability);
      })
      .catch((failure: unknown) => {
        if (mounted) {
          setVisibilityError(
            failure instanceof Error
              ? failure.message
              : 'Could not load available payment methods.',
          );
        }
      })
      .finally(() => {
        if (mounted) setLoadingVisibility(false);
      });
    return () => { mounted = false; };
  }, [edit]);

  const availableMethodTypes = methodVisibility
    ? PAYMENT_METHOD_TYPES.filter((method) =>
        isMethodVisible(methodVisibility, method.id),
      )
    : [];
  const currentKind = edit && original
    ? original.kind
    : methodVisibility && !isMethodVisible(methodVisibility, kind)
      ? availableMethodTypes[0]?.id ?? kind
      : kind;
  const currentFields = edit && original
    ? { ...fields, provider: fields.provider || original.provider, identifier: fields.identifier || original.identifier }
    : fields;
  const currentDefault = edit && original ? isDefault || original.isDefault : isDefault;
  const currentKindVisible =
    edit || Boolean(methodVisibility && isMethodVisible(methodVisibility, currentKind));

  const setField = (key: keyof MethodFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const selectProvider = (provider: string) => {
    setFields((current) => ({ ...current, provider, identifier: '' }));
    setErrors([]);
  };

  const submit = async () => {
    if (saving) return;
    const missing: string[] = [];
    if (currentKind === 'mobile-money') {
      if (!currentFields.provider) missing.push('Choose a mobile money provider.');
      if (!edit && currentFields.identifier.replace(/\D/g, '').length < 9) missing.push('Enter a valid phone number.');
    } else if (currentKind === 'bank') {
      if (!currentFields.provider.trim()) missing.push('Enter a bank name.');
      if (!edit && !currentFields.personName.trim()) missing.push('Enter the account name.');
      if (!edit && currentFields.identifier.replace(/\D/g, '').length < 6) missing.push('Enter a valid account number.');
    } else {
      if (!edit && !currentFields.personName.trim()) missing.push('Enter the cardholder name.');
      if (!edit && currentFields.identifier.replace(/\D/g, '').length < 12) missing.push('Enter a valid card number.');
      if (!edit) {
        const expiry = /^(\d{2})\/\d{2}$/.exec(currentFields.expiry);
        if (!expiry || Number(expiry[1]) < 1 || Number(expiry[1]) > 12) {
          missing.push('Enter a valid expiry date in MM/YY.');
        }
        if (!/^\d{3,4}$/.test(currentFields.cvv)) missing.push('Enter a valid CVV.');
      }
    }
    setErrors(missing);
    if (missing.length) return;

    const lastFour = edit && original
      ? original.identifier.replace(/\D/g, '').slice(-4)
      : currentFields.identifier.replace(/\D/g, '').slice(-4);
    const normalizedMobileNumber =
      currentKind === 'mobile-money'
        ? normalizeTzPhone(currentFields.identifier)
        : null;
    if (currentKind === 'mobile-money' && !edit && !normalizedMobileNumber) {
      setErrors(['Enter a valid Tanzanian phone number.']);
      return;
    }
    const provider = currentKind === 'card' ? 'Card' : currentFields.provider.trim();
    const name = currentKind === 'mobile-money'
      ? provider
      : currentKind === 'bank'
        ? `${provider} account`
        : provider;
    setSaving(true);
    setErrors([]);
    try {
    await savePaymentMethod({
      id: edit && original ? original.id : `method-${Date.now()}`,
      kind: currentKind,
      name,
      provider,
      identifier: `•••• ${lastFour}`,
      addedDate: original?.addedDate ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
      status: 'Active',
      usableForDeposit: edit
        ? original?.usableForDeposit ?? false
        : currentKind === 'mobile-money' && Boolean(normalizedMobileNumber),
      isDefault: currentDefault,
    }, normalizedMobileNumber ?? undefined);
    setFields(EMPTY_FIELDS);
    router.back();
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not save payment method.']);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: keyof MethodFields) => (value: string) => setField(key, value);

  if (edit && loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { padding: space.base, gap: space.lg }]}>
          <Header title="Edit Payment Method" onBack={() => router.back()} />
          <AppText variant="bodySmall" color={colors.textSecondary}>Loading saved method…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (edit && !original) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { padding: space.base, gap: space.lg }]}>
          <Header title="Edit Payment Method" onBack={() => router.back()} />
          <AppText variant="bodySmall" color={error ? colors.error : colors.textSecondary}>
            {error?.message ?? 'This saved payment method is no longer available.'}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.safeArea} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { padding: space.base, gap: space.lg }]}
          showsVerticalScrollIndicator={false}>
          <Header
            title={edit ? 'Edit Payment Method' : 'Add Payment Method'}
            subtitle="Choose a method type"
            onBack={() => router.back()}
          />
          {edit && loading ? (
            <AppText variant="bodySmall" color={colors.textSecondary}>Loading saved method…</AppText>
          ) : edit && error ? (
            <AppText variant="bodySmall" color={colors.error}>{error.message}</AppText>
          ) : null}
          {edit ? null : (
            loadingVisibility ? (
              <AppText variant="bodySmall" color={colors.textSecondary}>Loading available payment methods…</AppText>
            ) : visibilityError ? (
              <AppText variant="bodySmall" color={colors.error}>{visibilityError}</AppText>
            ) : availableMethodTypes.length ? (
              <PaymentMethodSelector
                methods={availableMethodTypes}
                selectedId={currentKind}
                onSelect={(method) => { setKind(method.id); setErrors([]); }}
              />
            ) : (
              <AppText variant="bodySmall" color={colors.textSecondary}>
                Payment methods are temporarily unavailable. Please contact support.
              </AppText>
            )
          )}
          {!edit ? (
            <AppIllustration
              name={currentKind === 'card' ? 'creditCard' : 'paymentDetails'}
              width={196}
              height={116}
            />
          ) : null}
          {currentKindVisible ? <View style={styles.form}>
            {edit && original ? (
              <>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  Only provider details and the last four digits are stored. The full payment credentials cannot be retrieved here.
                </AppText>
                {currentKind === 'mobile-money' ? (
                  <>
                    <AppText variant="bodySmallStrong">Provider</AppText>
                    <View style={styles.providerOptions}>
                      {PROVIDERS.map((provider) => (
                        <ProviderOption key={provider} provider={provider} selected={currentFields.provider === provider} onPress={() => setField('provider', provider)} />
                      ))}
                    </View>
                  </>
                ) : currentKind === 'bank' ? (
                  <FormField label="Bank name" placeholder="Bank name" value={currentFields.provider} onChangeText={updateField('provider')} />
                ) : (
                  <AppText variant="bodySmall">Card ending in {original.identifier.slice(-4)}</AppText>
                )}
                {currentKind !== 'card' ? (
                  <AppText variant="bodySmall" color={colors.textSecondary}>
                    Identifier ending in {original.identifier.slice(-4)} cannot be edited because its full value is not stored.
                  </AppText>
                ) : null}
              </>
            ) : currentKind === 'mobile-money' ? (
              <>
                <AppText variant="bodySmallStrong">Provider</AppText>
                <View style={styles.providerOptions}>
                  {PROVIDERS.map((provider) => (
                    <ProviderOption key={provider} provider={provider} selected={fields.provider === provider} onPress={() => selectProvider(provider)} />
                  ))}
                </View>
                {fields.provider ? (
                  <FormField
                    label={`${fields.provider} phone number`}
                    placeholder="712 345 678"
                    value={fields.identifier}
                    onChangeText={(value) => setField('identifier', getTzPhoneInputDigits(value))}
                    keyboardType="phone-pad"
                    maxLength={9}
                    leadingContent={
                      <View style={styles.phonePrefix} accessible accessibilityLabel="Tanzania, country code plus 255">
                        <AppText variant="bodySmall">🇹🇿</AppText>
                        <AppText variant="bodySmallStrong" color={colors.textSecondary}>+255</AppText>
                      </View>
                    }
                  />
                ) : (
                  <AppText variant="caption" color={colors.textSecondary}>
                    Choose a mobile network above to enter its phone number.
                  </AppText>
                )}
              </>
            ) : currentKind === 'bank' ? (
              <>
                <FormField label="Bank name" placeholder="e.g. NMB Bank" value={fields.provider} onChangeText={updateField('provider')} />
                <FormField label="Account name" placeholder="Name on the account" value={fields.personName} onChangeText={updateField('personName')} />
                <FormField label="Account number" placeholder="Enter account number" value={fields.identifier} onChangeText={updateField('identifier')} keyboardType="number-pad" maxLength={20} />
              </>
            ) : (
              <>
                <FormField label="Cardholder name" placeholder="Name on card" value={fields.personName} onChangeText={updateField('personName')} />
                <FormField label="Card number" placeholder="Card number" value={fields.identifier} onChangeText={updateField('identifier')} keyboardType="number-pad" maxLength={19} />
                <View style={styles.inlineFields}>
                  <View style={styles.inlineField}><FormField label="Expiry date" placeholder="MM/YY" value={fields.expiry} onChangeText={(value) => updateField('expiry')(value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(?=\d)/, '$1/'))} keyboardType="number-pad" maxLength={5} /></View>
                  <View style={styles.inlineField}><FormField label="CVV" placeholder="CVV" value={fields.cvv} onChangeText={updateField('cvv')} keyboardType="number-pad" maxLength={4} secureTextEntry /></View>
                </View>
              </>
            )}
          </View> : null}
          {currentKindVisible ? <View style={[styles.defaultRow, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14 }]}>
            <View style={styles.defaultCopy}>
              <AppText variant="bodyStrong">Set as default</AppText>
              <AppText variant="caption" color={colors.textSecondary}>Use this method first when paying</AppText>
            </View>
            <Switch
              value={currentDefault}
              onValueChange={setIsDefault}
              disabled={Boolean(edit && original?.isDefault)}
              trackColor={{ true: colors.primary }}
            />
          </View> : null}
          {currentKindVisible && errors.length ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorSoft }]}>
              {errors.map((error) => <AppText key={error} variant="caption" color={colors.error}>{error}</AppText>)}
            </View>
          ) : null}
          {currentKindVisible ? <AppText variant="caption" color={colors.textTertiary}>
            Only the provider and last four digits are stored. Card numbers, expiry dates, and security codes are never saved.
          </AppText> : null}
          {currentKindVisible ? <Button label={edit ? 'Save changes' : 'Add payment method'} loading={saving} onPress={() => void submit()} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function PaymentMethodDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { methods, loading, error } = usePaymentMethods();
  const item = methods.find((method) => method.id === params.id);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { colors, space } = useAppTheme();

  if (!item && loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { padding: space.base, gap: space.lg }]}>
          <Header title="Payment Method" onBack={() => router.back()} />
          <AppText variant="bodySmall" color={colors.textSecondary}>Loading payment method…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { padding: space.base, gap: space.lg }]}>
          <Header title="Payment Method" onBack={() => router.back()} />
          <AppText variant="body" color={colors.textSecondary}>{error?.message ?? 'This payment method is no longer available.'}</AppText>
          <Button label="Back to payment methods" onPress={() => router.replace('/payment-methods')} />
        </View>
      </SafeAreaView>
    );
  }

  const kindName = kindLabel(item.kind);
  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: space.base, gap: space.lg }]} showsVerticalScrollIndicator={false}>
        <Header title="Payment Method" subtitle="Method details" onBack={() => router.back()} />
        <View style={[styles.detailHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MethodIcon kind={item.kind} provider={item.provider} large />
          <AppText variant="title3" align="center">{item.name}</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary}>{item.identifier}</AppText>
          <View style={styles.badges}>
            <View style={[styles.defaultBadge, { backgroundColor: colors.successSoft }]}>
              <AppText variant="caption" color={colors.success}>{item.status}</AppText>
            </View>
            {item.isDefault ? <View style={[styles.defaultBadge, { backgroundColor: colors.primarySoft }]}><AppText variant="caption" color={colors.primary}>Default</AppText></View> : null}
          </View>
        </View>
        <View style={[styles.detailList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DetailRow label="Method type" value={kindName} />
          <DetailRow label={item.kind === 'mobile-money' ? 'Provider' : item.kind === 'bank' ? 'Bank' : 'Network'} value={item.provider} />
          <DetailRow label="Identifier" value={item.identifier} />
          <DetailRow label="Status" value={item.status} />
          <DetailRow label="Added" value={item.addedDate} last />
        </View>
        {!item.isDefault ? <Button label="Set as default" icon="check" onPress={() => void setPaymentMethodDefault(item.id).catch((error: unknown) => Alert.alert('Could not update payment method', error instanceof Error ? error.message : 'Please try again.'))} /> : null}
        <Button
          label="Edit method"
          icon="edit"
          variant="secondary"
          onPress={() => router.push({ pathname: '/payment-methods/edit/[id]', params: { id: item.id } })}
        />
        <Button label="Remove method" icon="logout" variant="danger" onPress={() => setConfirmRemove(true)} />
      </ScrollView>
      <AppDialog
        visible={confirmRemove}
        title="Remove payment method?"
        message={`Remove ${item.name} ending in ${item.identifier.slice(-4)} from your saved methods?`}
        onClose={() => setConfirmRemove(false)}
        confirmLabel="Remove"
        confirmDestructive
        dismissLabel="Keep method"
        onConfirm={() => {
          void removePaymentMethod(item.id)
            .then(() => { setConfirmRemove(false); router.replace('/payment-methods'); })
            .catch((error: unknown) => Alert.alert('Could not remove payment method', error instanceof Error ? error.message : 'Please try again.'));
        }}
      />
    </SafeAreaView>
  );
}

function MethodIcon({
  kind,
  provider,
  large = false,
}: {
  kind: MethodKind;
  provider: string;
  large?: boolean;
}) {
  const { colors, radius } = useAppTheme();
  const logo = kind === 'mobile-money' ? mobileNetworkLogo(provider) : undefined;
  return (
    <View
      style={[
        large ? styles.detailIcon : styles.methodIcon,
        { backgroundColor: colors.primarySoft, borderRadius: large ? radius.lg : radius.md },
      ]}>
      {logo ? (
        <Image
          source={logo}
          contentFit="contain"
          accessibilityLabel={`${provider} logo`}
          style={large ? styles.detailNetworkLogo : styles.networkLogo}
        />
      ) : (
        <AppIcon
          name={methodIcon(kind)}
          size={large ? 24 : 20}
          color={colors.primary}
        />
      )}
    </View>
  );
}

function ProviderOption({
  provider,
  selected,
  onPress,
}: {
  provider: (typeof PROVIDERS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, radius } = useAppTheme();
  const logo = mobileNetworkLogo(provider);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={provider}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.providerOption,
        {
          backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfacePressed : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radius.md,
        },
      ]}>
      {logo ? (
        <Image source={logo} contentFit="contain" accessibilityLabel={`${provider} logo`} style={styles.providerLogo} />
      ) : null}
      <AppText variant="caption" color={selected ? colors.primary : colors.text} numberOfLines={2}>
        {provider}
      </AppText>
    </Pressable>
  );
}

function FormField({
  label,
  leadingContent,
  ...props
}: { label: string; leadingContent?: ReactNode } & ComponentProps<typeof TextInput>) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={styles.field}>
      <AppText variant="bodySmallStrong">{label}</AppText>
      {leadingContent ? (
        <View
          style={[
            styles.input,
            styles.inputWithPrefix,
            { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md },
          ]}>
          {leadingContent}
          <TextInput
            accessibilityLabel={label}
            placeholderTextColor={colors.textTertiary}
            style={[styles.inputWithPrefixText, { color: colors.text }]}
            {...props}
          />
        </View>
      ) : (
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="words"
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}
          {...props}
        />
      )}
    </View>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <AppText variant="bodySmall" color={colors.textSecondary}>{label}</AppText>
      <AppText variant="bodySmallStrong" align="right" style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: 30 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerButton: { width: 42, height: 42, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 1 },
  intro: { maxWidth: 440 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  methodList: { gap: 10 },
  methodTile: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76 },
  methodIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  methodCopy: { flex: 1, gap: 5 },
  methodTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  defaultBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  emptyState: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, padding: 24, alignItems: 'center', gap: 10 },
  emptyIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  form: { gap: 14 },
  field: { gap: 7, flex: 1 },
  input: { minHeight: 50, borderWidth: 1, paddingHorizontal: 14, ...typography.input },
  inputWithPrefix: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputWithPrefixText: { flex: 1, minWidth: 0, paddingVertical: 0, ...typography.input },
  phonePrefix: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  providerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  providerOption: { width: '48%', minHeight: 58, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  providerLogo: { width: 42, height: 36, flexShrink: 0 },
  networkLogo: { width: 36, height: 36 },
  detailNetworkLogo: { width: 48, height: 48 },
  inlineFields: { flexDirection: 'row', gap: 12 },
  inlineField: { flex: 1 },
  defaultRow: { minHeight: 66, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  defaultCopy: { flex: 1, gap: 3 },
  errorBox: { padding: 12, borderRadius: 12, gap: 5 },
  detailHero: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: 'center', gap: 9 },
  detailIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 3 },
  detailList: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  detailRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailValue: { flex: 1 },
});
