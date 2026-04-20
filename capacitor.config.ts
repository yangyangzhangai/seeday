import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.seeday.app',
  appName: 'Plantime',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'none'
    }
  },
  ios: {
    contentInset: 'never',
    scheme: 'com.seeday.app'
  }
};

export default config;
