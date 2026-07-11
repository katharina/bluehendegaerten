// One-off backfill: reads width/height for every observation photo that's
// missing them (pre-existing uploads, from before obs-form.js started
// capturing dimensions at upload time) and writes them back to Supabase.
// Run with: node --env-file=.env.local scripts/backfill-obs-dimensions.js
import sharp from 'sharp';
import { supabase } from '../lib/supabase.js';
import { R2_PUBLIC_URL } from '../lib/config.js';

async function main() {
  const { data: rows, error } = await supabase
    .from('observations')
    .select('id, filename, width, height')
    .not('filename', 'is', null);
  if (error) throw error;

  const todo = rows.filter(r => r.width == null || r.height == null);
  console.log(`${todo.length} of ${rows.length} observations with a photo need dimensions`);

  let done = 0, failed = 0;
  for (const obs of todo) {
    try {
      const res = await fetch(`${R2_PUBLIC_URL}/${obs.filename}`);
      if (!res.ok) throw new Error(`R2 ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      // sharp's metadata() reports the raw stored pixel grid regardless of
      // .rotate() being queued in the pipeline — it doesn't apply until the
      // image is actually processed. EXIF orientation 5-8 means a 90/270°
      // rotation, which swaps what a browser (or our own /api/cover, which
      // does process the pixels) actually displays.
      const meta = await sharp(buf).metadata();
      const swapped = meta.orientation >= 5 && meta.orientation <= 8;
      const width  = swapped ? meta.height : meta.width;
      const height = swapped ? meta.width  : meta.height;
      const { error: updateError } = await supabase
        .from('observations')
        .update({ width, height })
        .eq('id', obs.id);
      if (updateError) throw updateError;
      done++;
    } catch (e) {
      failed++;
      console.error(`  obs ${obs.id} (${obs.filename}):`, e.message);
    }
    if ((done + failed) % 50 === 0) console.log(`  ${done + failed}/${todo.length}…`);
  }

  console.log(`\n✓ done — ${done} updated, ${failed} failed`);
}

main().catch(e => { console.error(e); process.exit(1); });
