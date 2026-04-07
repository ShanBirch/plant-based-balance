import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitgotchi.app',
  appName: 'Balance',

  // Load from live Netlify site — means you deploy as normal
  // and the app always shows the latest version
  server: {
    url: 'https://plantbased-balance.org/dashboard.html',
    cleartext: false,
    // Allow same-site navigations (login, oauth-callback, etc.) to stay
    // in the WebView.  Google OAuth intentionally opens the system browser
    // via NativePermissions.openExternalBrowser / window.open — that flow
    // is unaffected by allowNavigation.
    allowNavigation: ['plantbased-balance.org', '*.plantbased-balance.org'],
  },

  // Capacitor requires a webDir even when loading remotely
  webDir: 'www',

  ios: {
    // Append user agent so your JS can detect native app
    appendUserAgent: 'FitGotchi-Native',
    backgroundColor: '#1a1a2e',
  },

  android: {
    // Allow mixed content for any HTTP resources
    allowMixedContent: true,
    // Append user agent so your JS can detect native app
    appendUserAgent: 'FitGotchi-Native',
    // Enable background color during load
    backgroundColor: '#1a1a2e',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a2e',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notification',
      iconColor: '#6C63FF',
      sound: 'default',
    },
  },
};

export default config;
