import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitgotchi.app',
  appName: 'Balance',

  // Load from live Netlify site — means you deploy as normal
  // and the app always shows the latest version
  server: {
    url: 'https://plantbased-balance.org/dashboard.html',
    cleartext: false,
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
  },
};

export default config;
