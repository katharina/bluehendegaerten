import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [tailwindcss()],
    base: '/',
    define: {
      '__R2_URL__':            JSON.stringify(env.R2_PUBLIC_URL ?? ''),
      '__SUPABASE_URL__':      JSON.stringify(env.SUPABASE_URL ?? ''),
      '__SUPABASE_ANON_KEY__': JSON.stringify(env.SUPABASE_ANON_KEY_NEW ?? env.SUPABASE_ANON_KEY ?? ''),
    },
    server: {
      proxy: {
        '/api':     'http://localhost:3001',
        '/uploads': 'http://localhost:3001',
      },
    },
  };
});
