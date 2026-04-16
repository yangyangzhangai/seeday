import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { youwareVitePlugin } from '@youware/vite-plugin-react';

const paymentMode = process.env.VITE_PAYMENT_MODE === 'iap' ? 'iap' : 'stripe';
const paymentAlias = paymentMode === 'iap'
  ? path.resolve(__dirname, './src/services/payment/iap')
  : path.resolve(__dirname, './src/services/payment/stripe');

// https://vite.dev/config/
export default defineConfig({
  plugins: [youwareVitePlugin(), react()],
  resolve: {
    alias: {
      '@payment': paymentAlias,
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    sourcemap: true,
  },
  base: '/',
});
