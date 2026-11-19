// Vite config.
// In development, calls to /api and /uploads are forwarded to the backend
// (port 5000), so the frontend can use relative URLs like "/api/users"
// and we avoid CORS problems. In Docker, nginx does the same forwarding.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000',
    },
  },
});
