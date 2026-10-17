import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PinBoxes, ProfileField, StatusBanner } from '@/components/profile/profile-components';
import { PhoneField } from '@/components/ui/PhoneField';
import { AppText } from '@/components/ui/AppText';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button, DangerButton, SecondaryButton } from '@/components/ui/button';
import { IdempotencyKeyCache } from '@/lib/idempotency';
import {
  applyForMerchant,
  createMerchantFixedQr,
  createMerchantStaticQr,
  getMerchantApplication,
  getMerchantRegistrationFee,
  payMerchantRegistrationFee,
  revokeMerchantQr,
} from '@/lib/mori-api';
import { getTzPhoneInputDigits, normalizeTzPhone, prettyTzPhone } from '@/lib/phone';
import type {
  MerchantApplication,
  MerchantQrCode,
  MerchantRegistrationFee,
  TanzaniaMerchantBusinessType,
} from '@mori-pay/contracts';
import {
  TANZANIA_MERCHANT_BUSINESS_TYPES,
  TANZANIA_MERCHANT_BUSINESS_TYPE_LABELS,
  TANZANIA_REGIONS,
} from '@mori-pay/contracts';
import { ApiError } from '@/lib/api';
import { useAppTheme } from '@/theme';
import { formatMoney } from '@/utils/format-money';

type ExpiryChoice = 1 | 24 | 168;

function futureExpiry(hours: ExpiryChoice): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function applicationStatus(status: MerchantApplication['status']): { title: string; message: string } {
  switch (status) {
    case 'pending_payment':
      return {
        title: 'Application received',
        message: 'Your application is waiting for the registration-fee step.',
      };
    case 'awaiting_review':
      return {
        title: 'Under review',
        message: 'Your registration payment is confirmed. We will update this page after review.',
      };
    case 'approved':
      return {
        title: 'Approved',
        message: 'Your merchant account is approved. Create a QR code to accept payments.',
      };
    case 'rejected':
      return {
        title: 'Not approved',
        message: 'Your application was not approved. See the review feedback below.',
      };
  }
}

export function MerchantOnboardingScreen() {
  const { colors, radius, space } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const idempotency = useRef(new IdempotencyKeyCache());
  const [application, setApplication] = useState<MerchantApplication | null>(null);
  const [fee, setFee] = useState<MerchantRegistrationFee | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState<TanzaniaMerchantBusinessType | ''>('');
  const [category, setCategory] = useState('');
  const [tin, setTin] = useState('');
  const [businessLicenceNumber, setBusinessLicenceNumber] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [expiry, setExpiry] = useState<ExpiryChoice>(24);
  const [staticNoExpiry, setStaticNoExpiry] = useState(false);
  const [reusable, setReusable] = useState(false);
  const [createdQr, setCreatedQr] = useState<MerchantQrCode | null>(null);
  const [savedCode, setSavedCode] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextApplication, nextFee] = await Promise.all([
        getMerchantApplication(),
        getMerchantRegistrationFee(),
      ]);
      setApplication(nextApplication);
      setFee(nextFee);
      setLoaded(true);
      if (nextApplication) {
        setBusinessName(nextApplication.businessName);
        setBusinessType(nextApplication.businessType ?? '');
        setCategory(nextApplication.category);
        setTin(nextApplication.tin ?? '');
        setBusinessLicenceNumber(nextApplication.businessLicenceNumber ?? '');
        setRegion(nextApplication.region ?? '');
        setDistrict(nextApplication.district ?? '');
        setPhysicalAddress(nextApplication.physicalAddress ?? '');
        setPhone(nextApplication.phone ? getTzPhoneInputDigits(nextApplication.phone) : '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load merchant details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not complete that request. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const normalizedPhone = normalizeTzPhone(phone);
  const formReady =
    businessName.trim().length >= 2 &&
    businessType !== '' &&
    category.trim().length >= 2 &&
    /^\d{9}$/.test(tin.trim()) &&
    businessLicenceNumber.trim().length >= 2 &&
    region.trim().length >= 2 &&
    district.trim().length >= 2 &&
    physicalAddress.trim().length >= 4 &&
    normalizedPhone !== null;

  const submitApplication = () => run(async () => {
    if (!formReady || !normalizedPhone || !businessType) return;
    const created = await applyForMerchant({
      businessName: businessName.trim(),
      businessType,
      category: category.trim(),
      tin: tin.trim(),
      businessLicenceNumber: businessLicenceNumber.trim(),
      region: region.trim(),
      district: district.trim(),
      physicalAddress: physicalAddress.trim(),
      phone: normalizedPhone,
    });
    setApplication(created);
  });

  const submitFeePayment = (enteredPin: string) => run(async () => {
    if (!application || fee?.amount == null) return;
    const intent = `merchant-registration:${application.id}`;
    const updated = await payMerchantRegistrationFee({
      pin: enteredPin,
      idempotencyKey: idempotency.current.get(intent, 'merchant-registration'),
    });
    idempotency.current.clear(intent);
    setApplication(updated);
    setPin('');
  });

  const onPinChange = (next: string) => {
    if (busy) return;
    setPin(next);
    if (next.length === 6) void submitFeePayment(next);
  };

  const createStatic = () => run(async () => {
    const qr = await createMerchantStaticQr({
      expiresAt: staticNoExpiry ? undefined : futureExpiry(expiry),
    });
    setCreatedQr(qr);
    setSavedCode(false);
  });

  const createFixed = () => run(async () => {
    const amount = Number(fixedAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Enter a valid whole-number amount.');
    }
    const qr = await createMerchantFixedQr({
      amount,
      reusable,
      expiresAt: futureExpiry(expiry),
    });
    setCreatedQr(qr);
    setSavedCode(false);
  });

  const copyCode = async () => {
    if (!createdQr) return;
    await Clipboard.setStringAsync(createdQr.code);
    setSavedCode(true);
  };

  const shareCode = async () => {
    if (!createdQr) return;
    await Share.share({ message: `Mori Pay merchant QR code: ${createdQr.code}` });
  };

  const revoke = () => {
    if (!createdQr) return;
    void run(async () => {
      await revokeMerchantQr(createdQr.id);
      setCreatedQr(null);
      setSavedCode(false);
    });
  };

  const configuredFee = fee?.amount == null
    ? null
    : application?.registrationFeeAmount ?? fee.amount;
  const approved = application?.status === 'approved';

  return (
    <ScreenContainer
      header={
        <View style={{ paddingTop: insets.top }}>
          <ScreenHeader
            title="Merchant"
            subtitle="Apply, check your status, and accept QR payments"
            onBack={() => router.back()}
          />
        </View>
      }
      contentContainerStyle={styles.content}
    >
      {loading ? <AppText variant="bodySmall" color={colors.textSecondary}>Loading merchant details…</AppText> : null}
      {error ? (
        <StatusBanner tone="error" title="Could not complete request" message={error} onDismiss={() => setError(null)} />
      ) : null}
      {!loading && !loaded ? (
        <SecondaryButton label="Retry loading merchant details" block onPress={() => void reload()} />
      ) : null}
      {!loading && loaded && !application ? (
        <View style={styles.section}>
          <AppText variant="title2">Apply for a merchant account</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Your application will be reviewed before merchant features are enabled.
          </AppText>
          <ProfileField
            label="Business name"
            value={businessName}
            onChangeText={setBusinessName}
            autoCapitalize="words"
            maxLength={120}
            accessibilityLabel="Business name"
          />
          <View style={styles.field}>
            <AppText variant="bodySmallStrong">Business type</AppText>
            <View style={styles.chipGrid}>
              {TANZANIA_MERCHANT_BUSINESS_TYPES.map((type) => {
                const selected = businessType === type;
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={TANZANIA_MERCHANT_BUSINESS_TYPE_LABELS[type]}
                    onPress={() => setBusinessType(type)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primarySoft : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                        borderRadius: radius.md,
                      },
                    ]}>
                    <AppText variant="caption" color={selected ? colors.primary : colors.textSecondary}>
                      {TANZANIA_MERCHANT_BUSINESS_TYPE_LABELS[type]}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <ProfileField
            label="Business category"
            value={category}
            onChangeText={setCategory}
            autoCapitalize="words"
            maxLength={80}
            accessibilityLabel="Business category"
          />
          <ProfileField
            label="TIN (Taxpayer Identification Number)"
            value={tin}
            onChangeText={(value) => setTin(value.replace(/\D/g, '').slice(0, 9))}
            keyboardType="number-pad"
            maxLength={9}
            placeholder="123456789"
            hint="Your 9-digit TIN from TRA."
            error={tin !== '' && !/^\d{9}$/.test(tin) ? 'TIN must be exactly 9 digits.' : undefined}
            accessibilityLabel="Taxpayer identification number"
          />
          <ProfileField
            label="Business licence number"
            value={businessLicenceNumber}
            onChangeText={setBusinessLicenceNumber}
            autoCapitalize="characters"
            maxLength={60}
            accessibilityLabel="Business licence number"
          />
          <View style={styles.field}>
            <AppText variant="bodySmallStrong">Region</AppText>
            <View style={styles.chipGrid}>
              {TANZANIA_REGIONS.map((name) => {
                const selected = region === name;
                return (
                  <Pressable
                    key={name}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={name}
                    onPress={() => setRegion(name)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.primarySoft : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                        borderRadius: radius.md,
                      },
                    ]}>
                    <AppText variant="caption" color={selected ? colors.primary : colors.textSecondary}>
                      {name}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <ProfileField
            label="District"
            value={district}
            onChangeText={setDistrict}
            autoCapitalize="words"
            maxLength={80}
            placeholder="e.g. Kinondoni"
            accessibilityLabel="District"
          />
          <ProfileField
            label="Physical address"
            value={physicalAddress}
            onChangeText={setPhysicalAddress}
            autoCapitalize="sentences"
            maxLength={200}
            placeholder="Street, ward, building"
            accessibilityLabel="Physical business address"
          />
          <PhoneField
            label="Business phone number"
            value={phone}
            onChangeText={setPhone}
            error={phone !== '' && !normalizedPhone ? 'Enter a valid Tanzanian phone number.' : undefined}
          />
          <Button
            label="Submit application"
            loading={busy}
            disabled={!formReady}
            onPress={() => void submitApplication()}
          />
          {fee?.amount == null ? (
            <StatusBanner
              tone="info"
              title="Registration fee not configured"
              message="No fee is currently set. No payment will be requested or charged while the fee is unset."
            />
          ) : (
            <AppText variant="caption" color={colors.textSecondary}>
              Current registration fee: {formatMoney(fee.amount, 'TZS')}. Payment is requested only after application submission.
            </AppText>
          )}
        </View>
      ) : null}

      {application ? (
        <View style={styles.section}>
          <SecondaryButton
            label="Refresh application status"
            block
            loading={loading}
            disabled={loading}
            onPress={() => void reload()}
          />
          <AppText variant="title2">{application.businessName}</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            {application.businessType ? `${TANZANIA_MERCHANT_BUSINESS_TYPE_LABELS[application.businessType]} · ` : ''}
            {application.category}{application.phone ? ` · ${prettyTzPhone(application.phone)}` : ''}
          </AppText>
          {application.tin || application.businessLicenceNumber || application.region || application.district || application.physicalAddress ? (
            <View style={[styles.reviewNote, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.base }]}>
              <AppText variant="bodySmallStrong">Business details</AppText>
              {application.tin ? <AppText variant="bodySmall" color={colors.textSecondary}>TIN: {application.tin}</AppText> : null}
              {application.businessLicenceNumber ? <AppText variant="bodySmall" color={colors.textSecondary}>Licence: {application.businessLicenceNumber}</AppText> : null}
              {application.region || application.district ? (
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  {[application.region, application.district].filter(Boolean).join(' · ')}
                </AppText>
              ) : null}
              {application.physicalAddress ? <AppText variant="bodySmall" color={colors.textSecondary}>{application.physicalAddress}</AppText> : null}
            </View>
          ) : null}
          <StatusBanner
            tone={application.status === 'approved' ? 'success' : application.status === 'rejected' ? 'error' : 'info'}
            title={applicationStatus(application.status).title}
            message={applicationStatus(application.status).message}
          />
          {application.reviewNote ? (
            <View style={[styles.reviewNote, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.md, padding: space.base }]}>
              <AppText variant="bodySmallStrong">Review feedback</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary}>{application.reviewNote}</AppText>
            </View>
          ) : null}
          {application.status === 'rejected' ? (
            <>
              <AppText variant="caption" color={colors.textSecondary}>
                Questions about a registration payment? Its treatment after rejection is not shown here; contact Mori Pay support for clarification.
              </AppText>
              <SecondaryButton
                label="Submit a new application"
                block
                onPress={() => setApplication(null)}
              />
            </>
          ) : null}
          {application.status === 'pending_payment' ? (
            fee?.amount == null ? (
              <StatusBanner
                tone="info"
                title="Payment is unavailable"
                message="The registration fee has not been configured. You will not be charged; check back after it is set."
              />
            ) : (
              <View style={styles.section}>
                <AppText variant="bodyStrong">Registration fee: {formatMoney(configuredFee ?? fee.amount, 'TZS')}</AppText>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  Confirm with your existing wallet PIN. This request uses an idempotency key to prevent duplicate payment.
                </AppText>
                <PinBoxes
                  value={pin}
                  onChangeText={onPinChange}
                  autoFocus
                  editable={!busy}
                />
                <SecondaryButton label="Clear PIN" block disabled={busy || !pin} onPress={() => setPin('')} />
              </View>
            )
          ) : null}
        </View>
      ) : null}

      {approved ? (
        <View style={styles.section}>
          <SecondaryButton
            label="Open merchant dashboard"
            block
            onPress={() => router.push('/merchant-dashboard')}
          />
          <AppText variant="title2">Merchant QR</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Create a static QR for customer-entered amounts, or a fixed-amount QR. Choose an expiry and whether fixed codes are reusable or one-time.
          </AppText>
          <AppText variant="bodySmallStrong">QR expiry</AppText>
          <View style={styles.choices}>
            {([1, 24, 168] as const).map((hours) => {
              const selected = expiry === hours;
              return (
                <Pressable
                  key={`expiry-${hours}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={hours === 1 ? 'One hour' : hours === 24 ? '24 hours' : 'Seven days'}
                  onPress={() => setExpiry(hours)}
                  style={({ pressed }) => [
                    styles.choice,
                    {
                      backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfacePressed : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <AppText variant="caption" color={selected ? colors.primary : colors.textSecondary}>
                    {hours === 1 ? '1 hour' : hours === 24 ? '24 hours' : '7 days'}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: staticNoExpiry }}
            onPress={() => setStaticNoExpiry((value) => !value)}
            style={styles.reusableToggle}
          >
            <View style={[styles.checkbox, { borderColor: staticNoExpiry ? colors.primary : colors.border, backgroundColor: staticNoExpiry ? colors.primary : 'transparent' }]}>
              {staticNoExpiry ? <AppText variant="caption" color={colors.onPrimary}>✓</AppText> : null}
            </View>
            <AppText variant="bodySmall">Do not set an expiry on a static QR</AppText>
          </Pressable>
          <Button
            label="Create static QR"
            loading={busy}
            disabled={busy}
            onPress={() => void createStatic()}
          />
          <ProfileField
            label="Fixed amount (TZS)"
            value={fixedAmount}
            onChangeText={setFixedAmount}
            keyboardType="number-pad"
            accessibilityLabel="Fixed merchant QR amount in Tanzanian shillings"
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: reusable }}
            onPress={() => setReusable((value) => !value)}
            style={styles.reusableToggle}
          >
            <View style={[styles.checkbox, { borderColor: reusable ? colors.primary : colors.border, backgroundColor: reusable ? colors.primary : 'transparent' }]}>
              {reusable ? <AppText variant="caption" color={colors.onPrimary}>✓</AppText> : null}
            </View>
            <AppText variant="bodySmall">Allow this fixed QR to be reused until it expires</AppText>
          </Pressable>
          <Button label="Create fixed-amount QR" loading={busy} disabled={busy || !fixedAmount} onPress={() => void createFixed()} />

          {createdQr ? (
            <View style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <AppText variant="title3">{createdQr.kind === 'static' ? 'Static merchant QR' : 'Fixed-amount merchant QR'}</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary}>
                {createdQr.amount == null
                  ? 'Customers enter the amount before paying. This static code is reusable until it expires or is revoked.'
                  : `${formatMoney(createdQr.amount, 'TZS')} · ${createdQr.reusable ? 'Reusable' : 'One-time'}`}
              </AppText>
              {createdQr.expiresAt ? (
                <AppText variant="caption" color={colors.textSecondary}>Expires {new Date(createdQr.expiresAt).toLocaleString()}</AppText>
              ) : null}
              <View accessible accessibilityLabel="Your newly created merchant payment QR code">
                <QRCode value={createdQr.code} size={220} />
              </View>
              <AppText variant="caption" color={colors.textTertiary} selectable>
                {createdQr.code}
              </AppText>
              <StatusBanner
                tone={savedCode ? 'success' : 'info'}
                title={savedCode ? 'Code copied' : 'Save or share this QR now'}
                message="The code value is only returned when this QR is created. Copy or share it now; it cannot be retrieved later."
              />
              <SecondaryButton label="Copy QR code value" block onPress={() => void copyCode()} />
              <SecondaryButton label="Share QR code value" block onPress={() => void shareCode()} />
              <DangerButton label="Revoke this QR" block loading={busy} onPress={revoke} />
            </View>
          ) : null}
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20, paddingTop: 12, paddingBottom: 32 },
  section: { gap: 14 },
  field: { gap: 8 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  reviewNote: { borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  choices: { flexDirection: 'row', gap: 8 },
  choice: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, paddingHorizontal: 8 },
  reusableToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 5 },
  qrCard: { alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
});
