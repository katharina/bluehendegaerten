-- ── Gardens ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gardens (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Plans ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Custom plants ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_plants (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  name_de    TEXT,
  family     TEXT,
  color      TEXT,
  world_w    NUMERIC NOT NULL DEFAULT 0.5,
  world_h    NUMERIC NOT NULL DEFAULT 1.0,
  garden     TEXT NOT NULL DEFAULT 'betonbeete' REFERENCES gardens(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Observations ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS observations (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  garden     TEXT NOT NULL DEFAULT 'betonbeete' REFERENCES gardens(id),
  date       DATE,
  type       TEXT NOT NULL DEFAULT 'foto',
  text       TEXT,
  filename   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observation_plants (
  observation_id BIGINT NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
  slug           TEXT NOT NULL,
  PRIMARY KEY (observation_id, slug)
);

-- ── Bed images ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bed_images (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  garden     TEXT NOT NULL DEFAULT 'betonbeete' REFERENCES gardens(id),
  bed_index  INTEGER NOT NULL,
  filename   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(garden, bed_index)
);

-- ── Plant info ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plant_info (
  slug        TEXT PRIMARY KEY,
  art         TEXT,
  wuchs       TEXT,
  hoehe       TEXT,
  breite      TEXT,
  frost       TEXT,
  wurzel      TEXT,
  licht       TEXT,
  boden       TEXT,
  wasser      TEXT,
  naehrstoff  TEXT,
  ph          TEXT,
  kuebel      TEXT,
  bloom_months TEXT,
  invasiv     TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Seed initial garden ───────────────────────────────────────────────────────
INSERT INTO gardens (id, name) VALUES ('betonbeete', 'Die Betonbeete')
  ON CONFLICT (id) DO NOTHING;
