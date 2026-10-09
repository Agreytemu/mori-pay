/**
 * TEMPORARY FRONTEND DATA — milestone 1.
 * Static descriptions of the four money-movement surfaces. Once the action
 * screens exist these strings move into those screens; until then the
 * Payments screen renders them as UI affordances only.
 */

import { ROUTES } from '@/constants/navigation';
import type { PaymentAction } from '@/types';

export const PAYMENT_ACTIONS: readonly PaymentAction[] = [
  {
    id: 'send',
    title: 'Send money',
    description: 'Move funds to any Mori Pay number in seconds.',
    icon: 'send',
    route: ROUTES.payments,
    steps: ['Enter the phone number', 'Confirm the amount and note', 'Approve with your PIN'],
  },
  {
    id: 'receive',
    title: 'Receive money',
    description: 'Share your number or QR code and get paid instantly.',
    icon: 'receive',
    route: ROUTES.payments,
    steps: ['Share your Lipa number', 'Or let the payer scan your QR', 'Funds land in your wallet'],
  },
  {
    id: 'pay',
    title: 'Pay',
    description: 'Pay merchants, utilities and subscriptions from your balance.',
    icon: 'pay',
    route: ROUTES.payments,
    steps: ['Choose a merchant or biller', 'Check the details', 'Confirm with your PIN'],
  },
  {
    id: 'request',
    title: 'Request money',
    description: 'Ask anyone for a payment and track what is still outstanding.',
    icon: 'request',
    route: ROUTES.payments,
    steps: ['Enter the number to bill', 'Set the amount and reason', 'Send the request'],
  },
] as const;