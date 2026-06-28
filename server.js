import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import catchAll from './api/[...path].js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dirname, 'uploads');

const app = express();
app.use(express.json());

// Keep serving legacy local uploads (images uploaded before R2)
app.use('/uploads', express.static(UPLOADS));

// All /api/* routes delegate to the Supabase-backed handler
app.all('/api/*path', (req, res) => {
  const segments = req.path.replace(/^\/api\//, '').split('/').filter(Boolean);
  req.query.path = segments;
  return catchAll(req, res);
});

const PORT = 3001;
app.listen(PORT, () => console.log(`server running on http://localhost:${PORT}`));
