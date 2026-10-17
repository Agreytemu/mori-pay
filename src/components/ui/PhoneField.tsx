import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ProfileField } from '@/components/profile/profile-components';
import { AppText } from '@/components/ui/AppText';
import { getTzPhoneInputDigits } from '@/lib/phone';
import { useAppTheme } from '@/theme';

type ProfileFieldProps = ComponentProps<typeof ProfileField>;

/**
 * Phone input with the fixed Tanzanian `+255` prefix. The caller stores and
 * receives only the nine local digits; combine with `normalizeTzPhone` before
 * sending the value to the API.
 */
export function PhoneField({
  value,
  onChangeText,
  label = 'Phone number',
  placeholder = '712 345 678',
  maxLength = 9,
  ...rest
}: {
  value: string;
  onChangeText: (digits: string) => void;
  label?: string;
  placeholder?: string;
} & Omit<
  ProfileFieldProps,
  | 'value'
  | 'onChangeText'
  | 'label'
  | 'placeholder'
  | 'leadingContent'
  | 'keyboardType'
  | 'floatingLabel'
>) {
  const { colors } = useAppTheme();

  return (
    <ProfileField
      label={label}
      value={value}
      onChangeText={(next) => onChangeText(getTzPhoneInputDigits(next))}
      keyboardType="phone-pad"
      autoComplete="tel"
      maxLength={maxLength}
      placeholder={placeholder}
      floatingLabel={false}
      leadingContent={
        <View
          style={styles.prefix}
          accessible
          accessibilityLabel="Tanzania, country code plus 255">
          <AppText variant="bodySmall">🇹🇿</AppText>
          <AppText variant="bodySmallStrong" color={colors.textSecondary}>
            +255
          </AppText>
        </View>
      }
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  prefix: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
