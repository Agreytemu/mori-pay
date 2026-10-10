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
