import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TABLES = [
  'gardens',
  'observations',
  'observation_plants',
  'plant_info',
  'plans',
  'custom_plants',
  'bed_images',
  'profiles',
];

function escapeStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function escape(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    const items = val.map(v => typeof v === 'string' ? escapeStr(v) : escape(v)).join(', ');
    return `ARRAY[${items}]`;
  }
  if (typeof val === 'object') {
    return `${escapeStr(JSON.stringify(val))}::jsonb`;
  }
  return escapeStr(val);
}

function rowsToSql(table, rows) {
  if (!rows.length) return `-- ${table}: no rows\n`;
  const cols = Object.keys(rows[0]);
  const lines = rows.map(row => {
    const vals = cols.map(c => escape(row[c])).join(', ');
    return `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals}) ON CONFLICT DO NOTHING;`;
  });
  return `-- ${table} (${rows.length} rows)\n${lines.join('\n')}\n`;
}

async function run() {
  const parts = [`-- Supabase backup ${new Date().toISOString()}\n`];

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`  ⚠ ${table}: ${error.message}`);
      parts.push(`-- ${table}: ERROR ${error.message}\n`);
    } else {
      parts.push(rowsToSql(table, data ?? []));
      console.log(`  ✓ ${table}: ${(data ?? []).length} rows`);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outPath = join(__dirname, `../backups/supabase-${stamp}.sql`);
  try { mkdirSync(join(__dirname, '../backups'), { recursive: true }); } catch {}
  writeFileSync(outPath, parts.join('\n'));
  console.log(`\nBackup written to ${outPath}`);
}

run().catch(console.error);
