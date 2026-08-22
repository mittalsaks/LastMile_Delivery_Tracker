import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api calls to the backend during dev so no CORS config is needed.
// Change target if your backend runs on a different port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
