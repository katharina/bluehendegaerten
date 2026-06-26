import Database from 'better-sqlite3';
import { createClient } from '@supabase/supabase-js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../images.db'));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function run() {
  console.log('── plant_info ──────────────────────────────');
  const plantInfo = db.prepare('SELECT * FROM plant_info').all();
  if (plantInfo.length) {
    const rows = plantInfo.map(r => ({ ...r, updated_at: r.updated }));
    rows.forEach(r => delete r.updated);
    const { error } = await supabase.from('plant_info').upsert(rows);
    if (error) console.error('plant_info:', error.message);
    else console.log(`  inserted ${rows.length} rows`);
  }

  console.log('── custom_plants ───────────────────────────');
  const plants = db.prepare('SELECT * FROM custom_plants').all();
  if (plants.length) {
    const rows = plants.map(r => ({ ...r, created_at: r.created }));
    rows.forEach(r => delete r.created);
    const { error } = await supabase.from('custom_plants').upsert(rows);
    if (error) console.error('custom_plants:', error.message);
    else console.log(`  inserted ${rows.length} rows`);
  }

  console.log('── plans ───────────────────────────────────');
  const plans = db.prepare('SELECT * FROM plans').all();
  if (plans.length) {
    const rows = plans.map(r => ({ ...r, updated_at: r.updated }));
    rows.forEach(r => delete r.updated);
    const { error } = await supabase.from('plans').upsert(rows);
    if (error) console.error('plans:', error.message);
    else console.log(`  inserted ${rows.length} rows`);
  }

  console.log('── observations ────────────────────────────');
  const obs = db.prepare('SELECT * FROM observations').all();
  if (obs.length) {
    const idMap = new Map();
    for (const r of obs) {
      const oldId = r.id;
      const { data, error } = await supabase
        .from('observations')
        .insert({ garden: r.garden, date: r.date, type: r.type, text: r.text,
                  filename: r.filename, created_at: r.created })
        .select('id').single();
      if (error) { console.error(`  obs ${oldId}:`, error.message); continue; }
      idMap.set(oldId, data.id);
    }
    console.log(`  inserted ${idMap.size} rows`);
    console.log('── observation_plants ──────────────────────');
    const links = db.prepare('SELECT * FROM observation_plants').all();
    const remapped = links.map(l => ({ observation_id: idMap.get(l.observation_id), slug: l.slug }))
                          .filter(l => l.observation_id != null);
    if (remapped.length) {
      const { error: le } = await supabase.from('observation_plants').insert(remapped);
      if (le) console.error('observation_plants:', le.message);
      else console.log(`  inserted ${remapped.length} rows`);
    }
  }

  console.log('── bed_images ──────────────────────────────');
  const beds = db.prepare('SELECT * FROM bed_images').all();
  if (beds.length) {
    const rows = beds.map(r => ({ garden: r.garden, bed_index: r.bed_index,
                                   filename: r.filename, created_at: r.created }));
    const { error } = await supabase.from('bed_images').insert(rows);
    if (error) console.error('bed_images:', error.message);
    else console.log(`  inserted ${rows.length} rows`);
  }

  console.log('\n✓ done');
}

run().catch(console.error);
