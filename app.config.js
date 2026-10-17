const appJson = require('./app.json');

module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const fcmEnabled = process.env.EXPO_PUBLIC_FCM_ENABLED === 'true';

  if (fcmEnabled && !googleServicesFile) {
    throw new Error(
      'GOOGLE_SERVICES_JSON must point to the shared Firebase Android app configuration when EXPO_PUBLIC_FCM_ENABLED=true.',
    );
  }

  return {
    ...config,
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
