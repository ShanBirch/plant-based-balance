import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.balance.teleprompter',
  appName: 'Balance Teleprompter',
  webDir: 'www',
  ios: {
    appendUserAgent: 'BalanceTeleprompter-Native',
    backgroundColor: '#F8F5EE',
  },
  android: {
    appendUserAgent: 'BalanceTeleprompter-Native',
    backgroundColor: '#F8F5EE',
  },
};

export default config;
