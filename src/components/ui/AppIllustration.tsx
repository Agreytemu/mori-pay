import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

const ILLUSTRATIONS = {
  addingFunds: require('../../../assets/illustrations/undraw_adding-funds_gpjb.svg'),
  creditCard: require('../../../assets/illustrations/undraw_credit-card_t6qm.svg'),
  paymentDetails: require('../../../assets/illustrations/undraw_enter-payment-info_k1yw.svg'),
  mobilePay: require('../../../assets/illustrations/undraw_mobile-pay_yho9.svg'),
  moneyReceived: require('../../../assets/illustrations/undraw_money-received_eg1c.svg'),
  noSignal: require('../../../assets/illustrations/undraw_no-signal_nqfa.svg'),
  payments: require('../../../assets/illustrations/undraw_payments_nbqu.svg'),
  personalFinance: require('../../../assets/illustrations/undraw_personal-finance_xpqg.svg'),
  profileData: require('../../../assets/illustrations/undraw_profile-data_xkr9.svg'),
  qrScan: require('../../../assets/illustrations/undraw_qr-code-scan_bewe.svg'),
  receipt: require('../../../assets/illustrations/undraw_receipt_oemh.svg'),
  sendMoney: require('../../../assets/illustrations/undraw_send-money_4qc7.svg'),
  transferMoney: require('../../../assets/illustrations/undraw_transfer-money_5wd8.svg'),
  wallet: require('../../../assets/illustrations/undraw_wallet_diag.svg'),
} as const;

export type AppIllustrationName = keyof typeof ILLUSTRATIONS;

export function AppIllustration({
  name,
  width,
  height,
  style,
}: {
  name: AppIllustrationName;
  width: number;
  height: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={ILLUSTRATIONS[name]}
      contentFit="contain"
      accessible={false}
      style={[{ width, height }, style]}
    />
  );
}
