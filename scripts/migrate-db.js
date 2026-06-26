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
    const rows = obs.map(r => ({ ...r, created_at: r.created }));
    rows.forEach(r => delete r.created);
    const { error, data } = await supabase.from('observations').upsert(rows).select('id');
    if (error) { console.error('observations:', error.message); }
    else {
      console.log(`  inserted ${rows.length} rows`);
      console.log('── observation_plants ──────────────────────');
      const links = db.prepare('SELECT * FROM observation_plants').all();
      if (links.length) {
        const { error: le } = await supabase.from('observation_plants').upsert(links);
        if (le) console.error('observation_plants:', le.message);
        else console.log(`  inserted ${links.length} rows`);
      }
    }
  }

  console.log('── bed_images ──────────────────────────────');
  const beds = db.prepare('SELECT * FROM bed_images').all();
  if (beds.length) {
    const rows = beds.map(r => ({ ...r, created_at: r.created }));
    rows.forEach(r => delete r.created);
    const { error } = await supabase.from('bed_images').upsert(rows);
    if (error) console.error('bed_images:', error.message);
    else console.log(`  inserted ${rows.length} rows`);
  }

  console.log('\n✓ done');
}

run().catch(console.error);
