import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  base: '/',
  define: {
    '__R2_URL__':          JSON.stringify(process.env.R2_PUBLIC_URL ?? ''),
    '__SUPABASE_URL__':    JSON.stringify(process.env.SUPABASE_URL ?? ''),
    '__SUPABASE_ANON_KEY__': JSON.stringify(process.env.SUPABASE_ANON_KEY_NEW ?? process.env.SUPABASE_ANON_KEY ?? ''),
  },
  server: {
    proxy: {
      '/api':     'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
