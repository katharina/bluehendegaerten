#!/usr/bin/env node
// Runs PlantNet identification on all existing observation images
// and inserts matched plant slugs into observation_plants.
// Skips observations that already have slugs unless --all is passed.
//
// Usage: node --env-file=.env.local scripts/identify-existing.js
// Processes all observations with images, writes top-5 PlantNet suggestions
// (with scores) to plantnet_suggestions column for confirmation in the UI.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
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


console.log(`Processing all ${obs.length} observations with images…\n`);

let saved = 0, failed = 0;

for (const o of obs) {
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
    const suggestions = (pnData.results ?? []).slice(0, 5).map(r => ({
      name: r.species.scientificNameWithoutAuthor,
      score: Math.round(r.score * 100),
      slug: nameToSlug(r.species.scientificNameWithoutAuthor),
      family: r.species.family?.scientificNameWithoutAuthor ?? null,
    }));

    const { error } = await supabase.from('observations')
      .update({ plantnet_suggestions: JSON.stringify(suggestions) })
      .eq('id', o.id);
    if (error) throw new Error(error.message);

    console.log(suggestions.map(s => `${s.name} ${s.score}%${s.slug ? ` [${s.slug}]` : ''}`).join(', '));
    saved++;
  } catch (e) {
    console.log(`✗ ${e.message}`);
    failed++;
  }

  await new Promise(r => setTimeout(r, 600));
}

console.log(`\nDone: ${saved} saved, ${failed} errors`);
