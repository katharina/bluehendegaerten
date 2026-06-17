// One-off: process pre-existing JPEG source images through bg-removal + canvas normalization.
// Usage: node scripts/process-existing.js <slug>

import sharp from 'sharp';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeManifest } from './manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'plants');
const species   = JSON.parse(readFileSync(join(__dirname, 'species.json'), 'utf8'));

const MAX_PLANT_CM = 250;
const MAX_PX       = 2000;

// Removes a white/near-white background by color. Reliable for nursery-catalog
// style source images. Preserves saturated colours (green leaves, coloured petals).
async function removeWhiteBg(pngBuffer) {
  const { data, info } = await sharp(pngBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const out = Buffer.from(data);

  const THRESHOLD = 230; // pixels with all channels >= this AND low saturation → transparent
  const FEATHER   = 25;  // transition zone below threshold

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const minC = Math.min(r, g, b);
    const sat  = Math.max(r, g, b) - minC; // 0 = grey/white, high = colourful

    if (minC >= THRESHOLD && sat < 25) {
      out[i * 4 + 3] = 0;
    } else if (minC >= THRESHOLD - FEATHER && sat < 40) {
      const t = (minC - (THRESHOLD - FEATHER)) / FEATHER;
      out[i * 4 + 3] = Math.round((1 - t) * 255);
    }
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function alphaTrim(rgbaBuffer) {
  const { data, info } = await sharp(rgbaBuffer)
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let top = height, bottom = 0, left = width, right = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 40) {
        if (y < top)    top    = y;
        if (y > bottom) bottom = y;
        if (x < left)   left   = x;
        if (x > right)  right  = x;
      }
    }
  }
  if (top > bottom) return { buffer: rgbaBuffer, w: width, h: height };
  return {
    buffer: await sharp(rgbaBuffer)
      .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .toBuffer(),
    w: right - left + 1,
    h: bottom - top + 1,
  };
}

// Scales to fill canvasH (height is authoritative for worldH accuracy).
// Canvas width expands to fit the actual plant content so nothing is clipped.
async function normalizeCanvas(rgbaBuffer, canvasH) {
  const { buffer: trimmed, w, h } = await alphaTrim(rgbaBuffer);

  const sidePad = 24;
  const topPad  = 16;
  const scale   = (canvasH - topPad) / h;
  const fitH    = Math.round(h * scale);
  const fitW    = Math.round(w * scale);
  const canvasW = fitW + sidePad * 2;

  const resized = await sharp(trimmed).resize(fitW, fitH).toBuffer();

  const left = sidePad;
  const top  = canvasH - fitH; // plant anchored flush to bottom

  const buffer = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();

  return { buffer, canvasW, canvasH };
}

const args        = process.argv.slice(2).filter(a => !a.startsWith('--'));
const force       = process.argv.includes('--force');
const filterSlug  = args[0];
if (!filterSlug) { console.error('Usage: node scripts/process-existing.js <slug> [--force]'); process.exit(1); }

const plant = species.find(p => p.slug === filterSlug);
if (!plant) { console.error(`No species with slug "${filterSlug}"`); process.exit(1); }

mkdirSync(OUT_DIR, { recursive: true });

async function processOne(base, pngPath, canvasH) {
  const srcPath = join(OUT_DIR, `${base}_src.png`);
  if (!existsSync(srcPath)) { console.log(`  missing  ${base}_src.png — skipping`); return; }
  if (!force && existsSync(pngPath)) {
    console.log(`  skip     ${base}.png — already exists (use --force to overwrite)`);
    return;
  }
  console.log(`  process  ${base}`);
  const noBg = await removeWhiteBg(readFileSync(srcPath));
  const { buffer, canvasW } = await normalizeCanvas(noBg, canvasH);
  writeFileSync(pngPath, buffer);
  console.log(`  saved    ${base}.png  (${canvasW}×${canvasH})`);
}

for (const stage of plant.stages) {
  const canvasH = Math.round((stage.height_cm ?? plant.height_cm) / MAX_PLANT_CM * MAX_PX);
  const base = `${plant.slug}_${stage.id}`;
  await processOne(base, join(OUT_DIR, `${base}.png`), canvasH);

  for (let v = 2; v <= 10; v++) {
    const varBase = `${base}_${v}`;
    if (!existsSync(join(OUT_DIR, `${varBase}_src.png`))) break;
    await processOne(varBase, join(OUT_DIR, `${varBase}.png`), canvasH);
  }
}

writeManifest(species, OUT_DIR);
console.log('done.');
