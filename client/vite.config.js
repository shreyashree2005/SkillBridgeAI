import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, /api and /socket.io are proxied to the Node server, so the
// browser talks to a single origin (no CORS setup needed locally).
const API = process.env.VITE_DEV_API_PROXY || 'http://localhost:5000';

// A browser tab closing mid-write aborts the proxied WebSocket (ECONNABORTED /
// ECONNRESET). Without these handlers that error is unhandled and kills the
// Vite process; with them it is just logged.
const keepAlive = (proxy) => {
  proxy.on('error', (err) => console.warn(`[proxy] ${err.code || err.message}`));
  proxy.on('proxyReqWs', (proxyReq, req, socket) => {
    socket.on('error', (err) => console.warn(`[proxy ws] ${err.code || err.message}`));
  });
};

const proxy = {
  '/api': { target: API, changeOrigin: true, configure: keepAlive },
  '/socket.io': { target: API, ws: true, changeOrigin: true, configure: keepAlive },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
