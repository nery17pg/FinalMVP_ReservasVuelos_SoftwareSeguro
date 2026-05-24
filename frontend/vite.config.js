import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: {
      key: fs.readFileSync(path.resolve(__dirname, '../backend/localhost-key.pem')),
      cert: fs.readFileSync(path.resolve(__dirname, '../backend/localhost.pem')),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:4000',
        secure: false,
        changeOrigin: true,
      },
    },
  },
});