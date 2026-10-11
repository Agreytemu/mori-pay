import { PaymentsScreen } from '@/components/payment/payments-screen';

export default function SendPaymentRoute() {
  return <PaymentsScreen initialFlow="send" />;
}
