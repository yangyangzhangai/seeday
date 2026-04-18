import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.seeday.app',
  appName: 'Plantime',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'body'
    }
  },
  ios: {
    contentInset: 'never'
  }
};

export default config;
