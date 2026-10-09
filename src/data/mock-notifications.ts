export type NotificationType = 'payment' | 'transaction' | 'security' | 'account';

export type NotificationStatus = 'success' | 'failed' | 'pending' | 'info' | 'warning';

export type AppNotification = {
  id: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  amount?: number;
  reference?: string;
  recipient?: string;
  actionRoute?: string;
};

export const MOCK_NOTIFICATIONS: readonly AppNotification[] = [
  {
    id: 'notif-1',
    type: 'payment',
    status: 'success',
    title: 'Payment Successful',
    message: 'You sent TZS 250,000 to Amanda K.',
    timestamp: '2 min ago',
    read: false,
    amount: 250000,
    reference: 'LNA-482910',
    recipient: 'Amanda K.',
    actionRoute: '/(tabs)/transactions',
  },
  {
    id: 'notif-2',
    type: 'transaction',
    status: 'success',
    title: 'Money Received',
    message: 'David M. sent you TZS 75,000',
    timestamp: '15 min ago',
    read: false,
    amount: 75000,
    reference: 'LNA-482845',
    recipient: 'David M.',
    actionRoute: '/(tabs)/transactions',
  },
  {
    id: 'notif-3',
    type: 'security',
    status: 'warning',
    title: 'New Device Detected',
    message: 'A new device logged into your account from Dar es Salaam.',
    timestamp: '1 hour ago',
    read: false,
    actionRoute: '/account/security',
  },
  {
    id: 'notif-4',
    type: 'payment',
    status: 'failed',
    title: 'Payment Failed',
    message: 'Payment of TZS 180,000 to Mashujaa Market failed.',
    timestamp: '2 hours ago',
    read: true,
    amount: 180000,
    reference: 'LNA-482790',
    recipient: 'Mashujaa Market',
    actionRoute: '/(tabs)/transactions',
  },
  {
    id: 'notif-5',
    type: 'account',
    status: 'info',
    title: 'Payment Method Added',
    message: 'M-Pesa ending in 4821 was added to your account.',
    timestamp: '3 hours ago',
    read: true,
    actionRoute: '/payment-methods',
  },
  {
    id: 'notif-6',
    type: 'transaction',
    status: 'success',
    title: 'Withdrawal Completed',
    message: 'TZS 500,000 withdrawn to M-Pesa •••• 4821',
    timestamp: '5 hours ago',
    read: true,
    amount: 500000,
    reference: 'WTH-2026-0042',
    actionRoute: '/(tabs)/transactions',
  },
  {
    id: 'notif-7',
    type: 'security',
    status: 'info',
    title: 'Security Setting Changed',
    message: 'Your PIN was successfully updated.',
    timestamp: 'Yesterday',
    read: true,
    actionRoute: '/account/security',
  },
  {
    id: 'notif-8',
    type: 'transaction',
    status: 'success',
    title: 'Deposit Completed',
    message: 'TZS 1,000,000 deposited from NMB Bank •••• 7412',
    timestamp: 'Yesterday',
    read: true,
    amount: 1000000,
    reference: 'DEP-2026-0018',
    actionRoute: '/(tabs)/transactions',
  },
  {
    id: 'notif-9',
    type: 'payment',
    status: 'pending',
    title: 'Payment Pending',
    message: 'Payment of TZS 50,000 to Faith A. is being processed.',
    timestamp: 'Yesterday',
    read: true,
    amount: 50000,
    reference: 'LNA-482655',
    recipient: 'Faith A.',
    actionRoute: '/(tabs)/transactions',
  },
  {
    id: 'notif-10',
    type: 'account',
    status: 'info',
    title: 'Profile Updated',
    message: 'Your profile information was updated successfully.',
    timestamp: '2 days ago',
    read: true,
    actionRoute: '/account/personal-information',
  },
];
