import express from 'express';
import multer from 'multer';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOADS = join(__dirname, 'uploads');
const DB_PATH = join(__dirname, 'images.db');

mkdirSync(UPLOADS, { recursive: true });

const db = new Database(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id      TEXT PRIMARY KEY,
    data    TEXT NOT NULL,
    updated TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS custom_plants (
    slug     TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    name_de  TEXT,
    family   TEXT,
    color    TEXT,
    world_w  REAL NOT NULL DEFAULT 0.5,
    world_h  REAL NOT NULL DEFAULT 1.0,
    garden   TEXT NOT NULL DEFAULT 'betonbeete',
    created  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS observations (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    garden   TEXT NOT NULL DEFAULT 'betonbeete',
    date     TEXT,
    type     TEXT NOT NULL DEFAULT 'foto',
    text     TEXT,
    filename TEXT,
    created  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS observation_plants (
    observation_id INTEGER NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    slug           TEXT NOT NULL,
    PRIMARY KEY (observation_id, slug)
  )
`);

const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const app = express();
app.use(express.json());

app.use('/uploads', express.static(UPLOADS));

// ── Planting plans ────────────────────────────────────────────────────────────

app.get('/api/plans/:id', (req, res) => {
  const row = db.prepare('SELECT data FROM plans WHERE id = ?').get(req.params.id);
  res.json(row ? { data: row.data } : { data: null });
});

app.put('/api/plans/:id', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'missing data' });
  db.prepare(`
    INSERT INTO plans (id, data, updated) VALUES (?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated = excluded.updated
  `).run(req.params.id, data);
  res.json({ ok: true });
});

// ── Custom plants ─────────────────────────────────────────────────────────────

app.get('/api/custom-plants', (req, res) => {
  const { garden } = req.query;
  const rows = garden
    ? db.prepare('SELECT * FROM custom_plants WHERE garden = ? ORDER BY name').all(garden)
    : db.prepare('SELECT * FROM custom_plants ORDER BY name').all();
  res.json(rows);
});

app.post('/api/custom-plants', (req, res) => {
  const { slug, name, name_de, family, color, world_w, world_h, garden = 'betonbeete' } = req.body;
  if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
  try {
    const row = db.prepare(`
      INSERT INTO custom_plants (slug, name, name_de, family, color, world_w, world_h, garden)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *
    `).get(slug, name, name_de || null, family || null, color || null,
           parseFloat(world_w) || 0.5, parseFloat(world_h) || 1.0, garden);
    res.json(row);
  } catch (e) {
    res.status(409).json({ error: 'slug already exists' });
  }
});

app.delete('/api/custom-plants/:slug', (req, res) => {
  db.prepare('DELETE FROM custom_plants WHERE slug = ?').run(req.params.slug);
  res.json({ ok: true });
});

// ── Observations ──────────────────────────────────────────────────────────────

function withSlugs(rows) {
  return rows.map(r => {
    const slugs = db.prepare('SELECT slug FROM observation_plants WHERE observation_id = ?')
      .all(r.id).map(x => x.slug);
    return { ...r, slugs };
  });
}

// list: ?slug=X filters by plant, ?garden=X filters by garden
app.get('/api/observations', (req, res) => {
  const { slug, garden } = req.query;
  let rows;
  if (slug) {
    rows = db.prepare(`
      SELECT o.* FROM observations o
      JOIN observation_plants op ON op.observation_id = o.id AND op.slug = ?
      ORDER BY o.date DESC, o.created DESC
    `).all(slug);
  } else if (garden) {
    rows = db.prepare(`SELECT * FROM observations WHERE garden = ? ORDER BY date DESC, created DESC`).all(garden);
  } else {
    rows = db.prepare(`SELECT * FROM observations ORDER BY date DESC, created DESC`).all();
  }
  res.json(withSlugs(rows));
});

// create observation (optional file attachment)
app.post('/api/observations', upload.single('file'), (req, res) => {
  const { garden = 'betonbeete', date, type = 'foto', text } = req.body;
  let slugs = req.body.slugs ?? [];
  if (typeof slugs === 'string') slugs = slugs.split(',').map(s => s.trim()).filter(Boolean);

  const obs = db.prepare(
    'INSERT INTO observations (garden, date, type, text, filename) VALUES (?, ?, ?, ?, ?) RETURNING *'
  ).get(garden, date || null, type, text || null, req.file?.filename ?? null);

  const ins = db.prepare('INSERT OR IGNORE INTO observation_plants (observation_id, slug) VALUES (?, ?)');
  db.transaction(() => slugs.forEach(s => ins.run(obs.id, s)))();

  res.json({ ...obs, slugs });
});

// delete observation
app.delete('/api/observations/:id', (req, res) => {
  db.prepare('DELETE FROM observations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`server running on http://localhost:${PORT}`));
