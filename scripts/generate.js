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

async function normalizeCanvas(rgbaBuffer, canvasW, canvasH) {
  const trimmed  = await sharp(rgbaBuffer).trim({ threshold: 10 }).toBuffer();
  const { width, height } = await sharp(trimmed).metadata();

  const padding = 24;
  const scale   = Math.min((canvasW - padding * 2) / width, (canvasH - padding * 2) / height);
  const fitW    = Math.round(width  * scale);
  const fitH    = Math.round(height * scale);

  const resized = await sharp(trimmed).resize(fitW, fitH).toBuffer();

  // anchor bottom-center so billboard pivot-at-base aligns correctly
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

  const { canvasW, canvasH } = canvasSize(plant.height_cm, plant.width_cm);

  const raw        = Buffer.from(response.data[0].b64_json, 'base64');
  const noBg       = await removeBg(raw);
  const normalized = await normalizeCanvas(noBg, canvasW, canvasH);

  writeFileSync(outPath, normalized);
  console.log(`  saved ${filename}  (${canvasW}×${canvasH})`);
}

// always write full manifest from species.json (cheap, no API calls)
function writeManifest() {
  const entries = [];
  for (const plant of species) {
    const worldW = plant.width_cm  / 100;
    const worldH = plant.height_cm / 100;
    for (const stage of plant.stages) {
      const entry = {
        slug:    plant.slug,
        name:    plant.name,
        name_de: plant.name_de ?? null,
        stage:   stage.id,
        months:  stage.months,
        worldW,
        worldH,
        density: plant.density,
        seed:    plant.scatter_seed,
      };
      if (plant.beds)  entry.beds  = plant.beds;
      if (plant.color) entry.color = plant.color;
      entries.push(entry);
    }
  }
  const outPath = join(OUT_DIR, 'manifest.json');
  writeFileSync(outPath, JSON.stringify(entries, null, 2));
  console.log(`  manifest → ${entries.length} entries`);
}

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
writeManifest();
console.log('done.');
