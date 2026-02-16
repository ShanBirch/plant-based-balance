import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.plantbasedbalance.fitgotchi',
  appName: 'FitGotchi',
  webDir: 'www',
  server: {
    // Load from your live Netlify site — this means:
    // 1. You keep deploying to Netlify as normal
    // 2. The native app is just a shell that loads your site
    // 3. You only rebuild the APK when adding new native plugins
    // 4. All your edge functions, API routes, etc. work as-is
    url: 'https://plantbased-balance.org',
    cleartext: false,
  },
  android: {
    backgroundColor: '#1e3a5f',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#1e3a5f',
      showSpinner: false,
    },
  },
};

export default config;
