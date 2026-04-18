import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tshine.app',
  appName: 'Tshine',
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
