/**
 * One-time seed: import manifest colors into Supabase plant_info.
 * Only sets color where plant_info has no color yet — never overwrites.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  // Deduplicate manifest by first occurrence
  const manifest = JSON.parse(readFileSync(join(__dirname, '../public/plants/manifest.json'), 'utf8'));
  const bySlug = new Map();
  for (const p of manifest) if (!bySlug.has(p.slug)) bySlug.set(p.slug, p);

  // Fetch existing plant_info
  const { data: existing, error: fetchErr } = await supabase.from('plant_info').select('slug, color');
  if (fetchErr) { console.error('Fetch error:', fetchErr.message); process.exit(1); }

  const hasColor = new Set((existing ?? []).filter(r => r.color).map(r => r.slug));
  console.log(`${hasColor.size} plants already have a color in Supabase.`);

  const toSeed = [...bySlug.values()].filter(p => p.color && !hasColor.has(p.slug));
  console.log(`Seeding ${toSeed.length} plants from manifest…`);

  let ok = 0, fail = 0;
  for (const p of toSeed) {
    const { error } = await supabase.from('plant_info').upsert(
      { slug: p.slug, color: p.color, updated_at: new Date().toISOString() },
      { onConflict: 'slug', ignoreDuplicates: false }
    );
    if (error) { console.warn(`  ✗ ${p.slug}: ${error.message}`); fail++; }
    else { ok++; }
  }

  console.log(`\nDone: ${ok} seeded, ${fail} failed.`);
}

run().catch(console.error);
