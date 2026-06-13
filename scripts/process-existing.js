// One-off: process pre-existing JPEG source images through bg-removal + canvas normalization.
// Usage: node scripts/process-existing.js <slug>

import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeManifest } from './manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'plants');
const species   = JSON.parse(readFileSync(join(__dirname, 'species.json'), 'utf8'));

const MAX_PLANT_CM = 250;
const MAX_PX       = 1000;

async function removeBg(pngBuffer) {
  const blob   = new Blob([pngBuffer], { type: 'image/png' });
  const result = await removeBackground(blob);
  return Buffer.from(await result.arrayBuffer());
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

  const padding = 24;
  const scale   = (canvasH - padding * 2) / h;
  const fitH    = Math.round(h * scale);
  const fitW    = Math.round(w * scale);
  const canvasW = fitW + padding * 2;

  const resized = await sharp(trimmed).resize(fitW, fitH).toBuffer();

  const left = padding;
  const top  = canvasH - fitH - padding;

  const buffer = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();

  return { buffer, canvasW, canvasH };
}

const filterSlug = process.argv[2];
if (!filterSlug) { console.error('Usage: node scripts/process-existing.js <slug>'); process.exit(1); }

const plant = species.find(p => p.slug === filterSlug);
if (!plant) { console.error(`No species with slug "${filterSlug}"`); process.exit(1); }

mkdirSync(OUT_DIR, { recursive: true });

const canvasH = Math.round(plant.height_cm / MAX_PLANT_CM * MAX_PX);

for (const stage of plant.stages) {
  const jpegPath = join(OUT_DIR, `${plant.slug}_${stage.id}.jpeg`);
  const pngPath  = join(OUT_DIR, `${plant.slug}_${stage.id}.png`);

  if (!existsSync(jpegPath)) {
    console.log(`  missing  ${plant.slug}_${stage.id}.jpeg — skipping`);
    continue;
  }

  console.log(`  process  ${plant.slug}_${stage.id}`);

  const jpegBuf = readFileSync(jpegPath);
  const pngBuf  = await sharp(jpegBuf).png().toBuffer();
  const noBg    = await removeBg(pngBuf);
  const { buffer, canvasW } = await normalizeCanvas(noBg, canvasH);

  writeFileSync(pngPath, buffer);
  console.log(`  saved    ${plant.slug}_${stage.id}.png  (${canvasW}×${canvasH})`);
}

writeManifest(species, OUT_DIR);
console.log('done.');
