import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      tailwindcss(),
      {
        name: 'garden-router',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = (req.url ?? '/').split('?')[0];
            const isRoot     = url === '/';
            const hasExt     = /\.[^/]+$/.test(url);
            if (url === '/plants/all') { req.url = '/plants/all.html'; next(); return; }
            if (url.startsWith('/beobachtungen')) { req.url = '/beobachtungen/index.html'; next(); return; }
            const isReserved = url.startsWith('/api') ||
                               url.startsWith('/uploads') ||
                               url.startsWith('/plants') ||
                               url.startsWith('/@') ||
                               url.startsWith('/src') ||
                               url.startsWith('/node_modules') ||
                               url.startsWith('/globals') ||
                               url.startsWith('/style');
            if (!isRoot && !hasExt && !isReserved) {
              req.url = '/garden.html';
            }
            next();
          });
        },
      },
    ],
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
    build: {
      rollupOptions: {
        input: {
          main:           'index.html',
          garden:         'garden.html',
          plantsAll:      'plants/all.html',
          beobachtungen:  'beobachtungen/index.html',
        },
      },
    },
  };
});
