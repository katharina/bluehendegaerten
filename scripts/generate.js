// Usage: node scripts/generate.js [slug]
// Reads scripts/species.json, generates missing plant PNGs into public/plants/.
// Also writes public/plants/manifest.json for use by the app.
// Requires OPENAI_API_KEY in env. Skips files that already exist.

import OpenAI from 'openai';
import sharp from 'sharp';
import { removeBackground } from '@imgly/background-removal-node';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeManifest } from './manifest.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR   = join(__dirname, '..', 'public', 'plants');
const species   = JSON.parse(readFileSync(join(__dirname, 'species.json'), 'utf8'));

const client = new OpenAI();

const STYLE = [
  'professional garden nursery photograph',
  'natural clump with multiple stems as growing in a garden bed',
  'photographed against a pure white backdrop',
  'sharp focus throughout',
  'soft natural daylight',
  'no cast shadows on background',
  'entire plant fully visible from soil level to tip, nothing cropped',
  'photorealistic, not illustrated',
  'centered',
].join(', ');

function buildPrompt(plant, stage) {
  return stage.prompt ?? `${STYLE}. ${plant.name}. ${stage.description}.`;
}

function imageSize(height_cm, width_cm) {
  if (height_cm > width_cm * 1.2) return '1024x1536';
  if (width_cm > height_cm * 1.2) return '1536x1024';
  return '1024x1024';
}

const MAX_PLANT_CM = 250; // tallest possible plant — sets pixel scale
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

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4,
              background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer();
}

async function generate(plant, stage) {
  const filename = `${plant.slug}_${stage.id}.png`;
  const outPath  = join(OUT_DIR, filename);

  if (existsSync(outPath)) {
    console.log(`  skip  ${filename}`);
    return;
  }

  const prompt = buildPrompt(plant, stage);
  console.log(`  gen   ${filename}`);
  console.log(`        "${prompt}"`);

  const response = await client.images.generate({
    model:   'gpt-image-1',
    prompt,
    n:       1,
    size:    imageSize(plant.height_cm, plant.width_cm),
    quality: 'medium',
  });

  const canvasH = Math.round(plant.height_cm / MAX_PLANT_CM * MAX_PX);

  const raw  = Buffer.from(response.data[0].b64_json, 'base64');
  const noBg = await removeBg(raw);
  const img  = await normalizeCanvas(noBg, canvasH);

  writeFileSync(outPath, img);
  console.log(`  saved ${filename}  (dynamic×${canvasH})`);
}

// always write full manifest from species.json (cheap, no API calls)
function _writeManifest() { writeManifest(species, OUT_DIR); }

const filterSlug = process.argv[2];
const targets = filterSlug
  ? species.filter(p => p.slug === filterSlug)
  : species;

if (targets.length === 0) {
  console.error(`No species found${filterSlug ? ` matching "${filterSlug}"` : ''}.`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const plant of targets) {
  for (const stage of plant.stages) {
    await generate(plant, stage);
  }
}
_writeManifest();
console.log('done.');
