const appJson = require('./app.json');
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON || './server/google-services.json';
  const fcmEnabled = process.env.EXPO_PUBLIC_FCM_ENABLED === 'true';

  if (fcmEnabled && !googleServicesFile) {
    throw new Error(
      'GOOGLE_SERVICES_JSON must point to the shared Firebase Android app configuration when EXPO_PUBLIC_FCM_ENABLED=true.',
    );
  }

  if (fcmEnabled) {
    const resolvedGoogleServicesFile = path.isAbsolute(googleServicesFile)
      ? googleServicesFile
      : path.resolve(__dirname, googleServicesFile);
    if (!fs.existsSync(resolvedGoogleServicesFile)) {
      throw new Error('The configured Android Firebase google-services.json file does not exist.');
    }

    let firebaseConfig;
    try {
      firebaseConfig = JSON.parse(fs.readFileSync(resolvedGoogleServicesFile, 'utf8'));
    } catch {
      throw new Error('The configured Android Firebase google-services.json file is invalid.');
    }
    const packageName = appJson.expo.android.package;
    const hasMatchingAndroidApp = firebaseConfig.client?.some(
      (client) => client.client_info?.android_client_info?.package_name === packageName,
    );
    if (!hasMatchingAndroidApp) {
      throw new Error(
        `The Android Firebase configuration must include the ${packageName} application.`,
      );
    }
  }

  return {
    ...config,
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      googleServicesFile,
    },
  };
};
