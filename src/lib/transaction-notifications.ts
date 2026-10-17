import { Platform } from 'react-native';

import { getNotifications } from '@/lib/notifications';

const notifications = Platform.OS === 'web' ? null : getNotifications();

notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
