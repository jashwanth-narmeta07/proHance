import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on all network interfaces, not just localhost -
    // needed so another machine on the same network/wifi can reach the dev server
  },
});