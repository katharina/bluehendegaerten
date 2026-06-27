import express from 'express';
import multer from 'multer';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import catchAll from './api/[...path].js';
import { requireUser } from './lib/auth.js';

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
  );
  CREATE TABLE IF NOT EXISTS bed_images (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    garden    TEXT NOT NULL DEFAULT 'betonbeete',
    bed_index INTEGER NOT NULL,
    filename  TEXT NOT NULL,
    created   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(garden, bed_index)
  );
  CREATE TABLE IF NOT EXISTS plant_info (
    slug      TEXT PRIMARY KEY,
    art       TEXT,
    wuchs     TEXT,
    hoehe     TEXT,
    breite    TEXT,
    frost     TEXT,
    wurzel    TEXT,
    updated   TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// migrate: add columns that may not exist in older DBs
for (const col of ['licht', 'boden', 'wasser', 'naehrstoff', 'ph', 'kuebel', 'bloom_months', 'invasiv']) {
  try { db.exec(`ALTER TABLE plant_info ADD COLUMN ${col} TEXT`); } catch {}
}
for (const col of ['lat REAL', 'lon REAL', 'place TEXT']) {
  try { db.exec(`ALTER TABLE observations ADD COLUMN ${col}`); } catch {}
}

const storage = multer.diskStorage({
  destination: UPLOADS,
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
});

const app = express();
app.use(express.json());

app.use('/uploads', express.static(UPLOADS));

// ── Planting plans ────────────────────────────────────────────────────────────

app.get('/api/plans/:id', (req, res) => {
  const row = db.prepare('SELECT data FROM plans WHERE id = ?').get(req.params.id);
  res.json(row ? { data: row.data } : { data: null });
});

app.put('/api/plans/:id', async (req, res) => {
  if (!await requireUser(req, res)) return;
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

app.post('/api/custom-plants', async (req, res) => {
  if (!await requireUser(req, res)) return;
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

app.patch('/api/custom-plants/:slug', async (req, res) => {
  if (!await requireUser(req, res)) return;
  const { name, name_de, family, color, world_w, world_h } = req.body;
  const fields = [];
  const values = [];
  if (name    !== undefined) { fields.push('name = ?');    values.push(name); }
  if (name_de !== undefined) { fields.push('name_de = ?'); values.push(name_de); }
  if (family  !== undefined) { fields.push('family = ?');  values.push(family); }
  if (color   !== undefined) { fields.push('color = ?');   values.push(color); }
  if (world_w !== undefined) { fields.push('world_w = ?'); values.push(parseFloat(world_w) || 0.5); }
  if (world_h !== undefined) { fields.push('world_h = ?'); values.push(parseFloat(world_h) || 1.0); }
  if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
  values.push(req.params.slug);
  db.prepare(`UPDATE custom_plants SET ${fields.join(', ')} WHERE slug = ?`).run(...values);
  res.json({ ok: true });
});

app.delete('/api/custom-plants/:slug', async (req, res) => {
  if (!await requireUser(req, res)) return;
  db.prepare('DELETE FROM custom_plants WHERE slug = ?').run(req.params.slug);
  res.json({ ok: true });
});

// ── Bed images ────────────────────────────────────────────────────────────────

app.get('/api/bed-images', (req, res) => {
  const { garden = 'betonbeete' } = req.query;
  res.json(db.prepare('SELECT * FROM bed_images WHERE garden = ?').all(garden));
});

app.post('/api/bed-images', upload.single('file'), async (req, res) => {
  if (!await requireUser(req, res)) return;
  const { garden = 'betonbeete', bed_index } = req.body;
  if (!req.file) return res.status(400).json({ error: 'file required' });
  db.prepare(`
    INSERT INTO bed_images (garden, bed_index, filename)
    VALUES (?, ?, ?)
    ON CONFLICT(garden, bed_index) DO UPDATE SET filename = excluded.filename, created = datetime('now')
  `).run(garden, parseInt(bed_index), req.file.filename);
  res.json({ ok: true, filename: req.file.filename });
});

app.delete('/api/bed-images/:id', async (req, res) => {
  if (!await requireUser(req, res)) return;
  db.prepare('DELETE FROM bed_images WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Plant info ────────────────────────────────────────────────────────────────

app.patch('/api/plant-info/:slug', async (req, res) => {
  if (!await requireUser(req, res)) return;
  const allowed = ['art','wuchs','hoehe','breite','frost','wurzel','licht','boden','wasser','naehrstoff','ph','kuebel','bloom_months','invasiv'];
  const fields = [], values = [];
  for (const [k, v] of Object.entries(req.body)) {
    if (allowed.includes(k)) { fields.push(`${k} = ?`); values.push(v ?? null); }
  }
  if (!fields.length) return res.status(400).json({ error: 'nothing to update' });
  values.push(req.params.slug);
  db.prepare(`
    INSERT INTO plant_info (slug) VALUES (?) ON CONFLICT(slug) DO NOTHING
  `).run(req.params.slug);
  db.prepare(`UPDATE plant_info SET ${fields.join(', ')}, updated = datetime('now') WHERE slug = ?`).run(...values);
  res.json({ ok: true });
});

app.get('/api/plant-info/all', (req, res) => {
  res.json(db.prepare('SELECT * FROM plant_info').all());
});

app.get('/api/plant-info/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM plant_info WHERE slug = ?').get(req.params.slug);
  res.json(row ?? { slug: req.params.slug });
});

app.put('/api/plant-info/:slug', async (req, res) => {
  if (!await requireUser(req, res)) return;
  const { art, wuchs, hoehe, breite, frost, wurzel, licht, boden, wasser, naehrstoff, ph, kuebel, bloom_months, invasiv } = req.body;
  db.prepare(`
    INSERT INTO plant_info (slug, art, wuchs, hoehe, breite, frost, wurzel, licht, boden, wasser, naehrstoff, ph, kuebel, bloom_months, invasiv)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      art = excluded.art, wuchs = excluded.wuchs, hoehe = excluded.hoehe,
      breite = excluded.breite, frost = excluded.frost, wurzel = excluded.wurzel,
      licht = excluded.licht, boden = excluded.boden, wasser = excluded.wasser,
      naehrstoff = excluded.naehrstoff, ph = excluded.ph, kuebel = excluded.kuebel,
      bloom_months = excluded.bloom_months, invasiv = excluded.invasiv, updated = datetime('now')
  `).run(req.params.slug, art ?? null, wuchs ?? null, hoehe ?? null, breite ?? null,
         frost ?? null, wurzel ?? null, licht ?? null, boden ?? null, wasser ?? null,
         naehrstoff ?? null, ph ?? null, kuebel ?? null, bloom_months ?? null, invasiv ?? null);
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
    rows = db.prepare(`SELECT * FROM observations WHERE garden = ? ORDER BY id DESC`).all(garden);
  } else {
    rows = db.prepare(`SELECT * FROM observations ORDER BY id DESC`).all();
  }
  res.json(withSlugs(rows));
});

// create observation (optional file attachment)
app.post('/api/observations', upload.single('file'), async (req, res) => {
  if (!await requireUser(req, res)) return;
  const { garden = 'betonbeete', date, type = 'foto', text, filename: bodyFilename, lat, lon } = req.body;
  let slugs = req.body.slugs ?? [];
  if (typeof slugs === 'string') slugs = slugs.split(',').map(s => s.trim()).filter(Boolean);

  const obs = db.prepare(
    'INSERT INTO observations (garden, date, type, text, filename, lat, lon) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *'
  ).get(garden, date || null, type, text || null, req.file?.filename ?? bodyFilename ?? null, lat ?? null, lon ?? null);

  const ins = db.prepare('INSERT OR IGNORE INTO observation_plants (observation_id, slug) VALUES (?, ?)');
  db.transaction(() => slugs.forEach(s => ins.run(obs.id, s)))();

  res.json({ ...obs, slugs });
});

// update observation
app.patch('/api/observations/:id', upload.single('file'), async (req, res) => {
  if (!await requireUser(req, res)) return;
  const { date, type, text, lat, lon, place } = req.body;
  let slugs = req.body.slugs ?? [];
  if (typeof slugs === 'string') slugs = slugs.split(',').map(s => s.trim()).filter(Boolean);
  const fields = [], values = [];
  if (date  !== undefined) { fields.push('date = ?');  values.push(date || null); }
  if (type  !== undefined) { fields.push('type = ?');  values.push(type); }
  if (text  !== undefined) { fields.push('text = ?');  values.push(text || null); }
  if (req.file)             { fields.push('filename = ?'); values.push(req.file.filename); }
  if (lat   !== undefined) { fields.push('lat = ?');   values.push(lat ?? null); }
  if (lon   !== undefined) { fields.push('lon = ?');   values.push(lon ?? null); }
  if (place !== undefined) { fields.push('place = ?'); values.push(place || null); }
  if (fields.length) {
    values.push(req.params.id);
    db.prepare(`UPDATE observations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }
  db.prepare('DELETE FROM observation_plants WHERE observation_id = ?').run(req.params.id);
  const ins = db.prepare('INSERT OR IGNORE INTO observation_plants (observation_id, slug) VALUES (?, ?)');
  db.transaction(() => slugs.forEach(s => ins.run(req.params.id, s)))();
  res.json({ ok: true });
});

// delete observation
app.delete('/api/observations/:id', async (req, res) => {
  if (!await requireUser(req, res)) return;
  db.prepare('DELETE FROM observations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Supabase catch-all (gardens, profiles, health, upload-url) ────────────────

app.all('/api/*', (req, res, next) => {
  const segments = req.path.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resource = segments[0];
  // let SQLite routes above handle these
  if (['plans','custom-plants','bed-images','plant-info','observations'].includes(resource)) return next();
  req.query.path = segments;
  return catchAll(req, res);
});

const PORT = 3001;
app.listen(PORT, () => console.log(`server running on http://localhost:${PORT}`));
