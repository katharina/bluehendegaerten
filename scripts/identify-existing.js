#!/usr/bin/env node
// Runs PlantNet identification on all existing observation images
// and inserts matched plant slugs into observation_plants.
// Skips observations that already have slugs unless --all is passed.
//
// Usage: node --env-file=.env.local scripts/identify-existing.js [--all]
// Images are fetched via the deployed thumb endpoint — no R2 credentials needed locally.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALL = process.argv.includes('--all');
const BASE = process.env.APP_URL || 'https://bluehendegaerten.vercel.app';

const PLANTNET_API_KEY    = process.env.PLANTNET_API_KEY;
const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PLANTNET_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Run with:\n  node --env-file=.env.local scripts/identify-existing.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Build reverse lookup: scientific name / genus → slug
const manifest = JSON.parse(readFileSync(join(__dirname, '../public/plants/manifest.json'), 'utf8'));
const uniquePlants = [...new Map(manifest.map(p => [p.slug, p])).values()];
const byScientificName = new Map();
for (const p of uniquePlants) {
  byScientificName.set(p.name.toLowerCase(), p.slug);
  const genus = p.name.split(' ')[0].toLowerCase();
  if (!byScientificName.has(genus)) byScientificName.set(genus, p.slug);
}

function nameToSlug(name) {
  const lower = name.toLowerCase();
  if (byScientificName.has(lower)) return byScientificName.get(lower);
  return byScientificName.get(lower.split(' ')[0]) ?? null;
}

// Fetch all observations with images
const { data: obs, error: obsErr } = await supabase
  .from('observations')
  .select('id, filename')
  .not('filename', 'is', null)
  .order('id', { ascending: false });
if (obsErr) { console.error(obsErr); process.exit(1); }

// Fetch existing links so we can skip / avoid duplicates
const { data: existingLinks } = await supabase
  .from('observation_plants')
  .select('observation_id, slug');
const existingMap = new Map();
for (const l of existingLinks ?? []) {
  if (!existingMap.has(l.observation_id)) existingMap.set(l.observation_id, new Set());
  existingMap.get(l.observation_id).add(l.slug);
}

const candidates = ALL
  ? obs
  : obs.filter(o => !existingMap.has(o.id) || existingMap.get(o.id).size === 0);

console.log(`${obs.length} observations with images, processing ${candidates.length} (${ALL ? 'all' : 'without slugs'})…\n`);

let identified = 0, noMatch = 0, failed = 0;

for (const o of candidates) {
  const existing = existingMap.get(o.id) ?? new Set();
  process.stdout.write(`  #${o.id} ${o.filename}: `);

  try {
    const imgRes = await fetch(`${BASE}/api/thumb/${encodeURIComponent(o.filename)}`);
    if (!imgRes.ok) throw new Error(`thumb ${imgRes.status}`);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());

    const form = new FormData();
    form.append('images', new Blob([imgBuf], { type: 'image/jpeg' }), 'image.jpg');
    form.append('organs', 'auto');

    const pnRes = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_API_KEY}&lang=de&include-related-images=false`,
      { method: 'POST', body: form }
    );
    if (!pnRes.ok) throw new Error(`PlantNet ${pnRes.status}: ${await pnRes.text()}`);

    const pnData = await pnRes.json();
    const top = (pnData.results ?? []).slice(0, 3);

    const newSlugs = [];
    for (const r of top) {
      const slug = nameToSlug(r.species.scientificNameWithoutAuthor);
      if (slug && !existing.has(slug) && !newSlugs.includes(slug)) newSlugs.push(slug);
    }

    if (newSlugs.length) {
      const { error: insErr } = await supabase.from('observation_plants')
        .upsert(newSlugs.map(slug => ({ observation_id: o.id, slug })), { onConflict: 'observation_id,slug' });
      if (insErr) throw new Error(insErr.message);
      const topNames = top.map(r => `${r.species.scientificNameWithoutAuthor} (${Math.round(r.score * 100)}%)`).join(', ');
      console.log(`✓ ${newSlugs.join(', ')}  [${topNames}]`);
      identified++;
    } else {
      const topNames = top.map(r => r.species.scientificNameWithoutAuthor).join(', ') || 'none';
      console.log(`— no match  [top: ${topNames}]`);
      noMatch++;
    }
  } catch (e) {
    console.log(`✗ ${e.message}`);
    failed++;
  }

  await new Promise(r => setTimeout(r, 600));
}

console.log(`\nDone: ${identified} identified, ${noMatch} no match, ${failed} errors`);
