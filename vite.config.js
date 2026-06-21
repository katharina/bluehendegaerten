import { defineConfig } from 'vite';

export default defineConfig({
  base: '/bluehendegaerten/',
  server: {
    proxy: {
      '/api':     'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
