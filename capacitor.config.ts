import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fitgotchi.app',
  appName: 'Balance',

  // Load from live Netlify site — means you deploy as normal
  // and the app always shows the latest version
  server: {
    url: 'https://plantbased-balance.org/dashboard.html',
    cleartext: false,
    // NOTE: allowNavigation for Google/Supabase was removed.
    // Google blocks OAuth from embedded WebViews (403 disallowed_useragent).
    // The native Google sign-in flow now opens the system browser instead
    // and returns to the app via the com.fitgotchi.app:// custom URL scheme.
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
