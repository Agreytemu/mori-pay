importScripts(
  'https://www.gstatic.com/firebasejs/12.8.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/12.8.0/firebase-messaging-compat.js',
);

const encodedConfig = new URL(self.location.href).searchParams.get('config');
if (!encodedConfig) {
  throw new Error('Firebase messaging service worker is missing its public app configuration.');
}

firebase.initializeApp(JSON.parse(encodedConfig));
firebase.messaging();
