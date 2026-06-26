import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  base: '/',
  define: {
    '__R2_URL__': JSON.stringify(process.env.R2_PUBLIC_URL ?? ''),
  },
  server: {
    proxy: {
      '/api':     'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
