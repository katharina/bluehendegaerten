// One-off: process pre-existing JPEG source images through bg-removal + canvas normalization.
// Usage: node scripts/process-existing.js <slug>

import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeManifest } from './manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'plants');
const species   = JSON.parse(readFileSync(join(__dirname, 'species.json'), 'utf8'));

const MAX_PLANT_CM = 250;
const MAX_PX       = 1000;

function canvasSize(height_cm, width_cm) {
  return {
    canvasH: Math.round(height_cm / MAX_PLANT_CM * MAX_PX),
    canvasW: Math.round(width_cm  / MAX_PLANT_CM * MAX_PX),
  };
}

async function removeBg(pngBuffer) {
  const blob   = new Blob([pngBuffer], { type: 'image/png' });
  const result = await removeBackground(blob);
  return Buffer.from(await result.arrayBuffer());
}

async function normalizeCanvas(rgbaBuffer, canvasW, canvasH) {
  const trimmed  = await sharp(rgbaBuffer).trim({ threshold: 10 }).toBuffer();
  const { width, height } = await sharp(trimmed).metadata();

  const padding = 24;
  const scale   = Math.min((canvasW - padding * 2) / width, (canvasH - padding * 2) / height);
  const fitW    = Math.round(width  * scale);
  const fitH    = Math.round(height * scale);

  const resized = await sharp(trimmed).resize(fitW, fitH).toBuffer();

  const left = Math.round((canvasW - fitW) / 2);
  const top  = canvasH - fitH - padding;

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}


const filterSlug = process.argv[2];
if (!filterSlug) { console.error('Usage: node scripts/process-existing.js <slug>'); process.exit(1); }

const plant = species.find(p => p.slug === filterSlug);
if (!plant) { console.error(`No species with slug "${filterSlug}"`); process.exit(1); }

mkdirSync(OUT_DIR, { recursive: true });

for (const stage of plant.stages) {
  const jpegPath = join(OUT_DIR, `${plant.slug}_${stage.id}.jpeg`);
  const pngPath  = join(OUT_DIR, `${plant.slug}_${stage.id}.png`);

  if (!existsSync(jpegPath)) {
    console.log(`  missing  ${plant.slug}_${stage.id}.jpeg — skipping`);
    continue;
  }

  console.log(`  process  ${plant.slug}_${stage.id}`);
  const { canvasW, canvasH } = canvasSize(plant.height_cm, plant.width_cm);

  const jpegBuf    = readFileSync(jpegPath);
  const pngBuf     = await sharp(jpegBuf).png().toBuffer();
  const noBg       = await removeBg(pngBuf);
  const normalized = await normalizeCanvas(noBg, canvasW, canvasH);

  writeFileSync(pngPath, normalized);
  console.log(`  saved    ${plant.slug}_${stage.id}.png  (${canvasW}×${canvasH})`);
}

writeManifest(species, OUT_DIR);
console.log('done.');
