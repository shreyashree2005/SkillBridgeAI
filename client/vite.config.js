import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api and /socket.io are proxied to the Node server, so the
// browser talks to a single origin (no CORS setup needed locally).
const API = process.env.VITE_DEV_API_PROXY || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API, changeOrigin: true },
      '/socket.io': { target: API, ws: true, changeOrigin: true },
    },
  },
});
