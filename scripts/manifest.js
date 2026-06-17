// Single source of truth for manifest generation.
// Both generate.js and process-existing.js import this.

import { writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

function countVariants(outDir, slug, stageId) {
  let files;
  try { files = new Set(readdirSync(outDir)); } catch { return 1; }
  const base = `${slug}_${stageId}`;
  if (!files.has(`${base}.png`)) return 1;
  let count = 1;
  for (let v = 2; v <= 10; v++) {
    if (files.has(`${base}_${v}.png`)) count = v; else break;
  }
  return count;
}

export function writeManifest(species, outDir) {
  const entries = [];
  for (const plant of species) {
    const worldW = plant.width_cm / 100;
    for (const stage of plant.stages) {
      const worldH = (stage.height_cm ?? plant.height_cm) / 100;
      const variants = countVariants(outDir, plant.slug, stage.id);
      const entry = {
        slug:    plant.slug,
        name:    plant.name,
        name_de: plant.name_de ?? null,
        color:   plant.color   ?? null,
        stage:   stage.id,
        months:  stage.months,
        worldW,
        worldH: Math.round(worldH * 1000) / 1000,
        density: plant.density,
        seed:    plant.scatter_seed,
      };
      if (variants > 1) entry.variants = variants;
      if (plant.beds) entry.beds = plant.beds;
      if (plant.placement_type) entry.placementType = plant.placement_type;
      entries.push(entry);
    }
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(entries, null, 2));
  console.log(`  manifest → ${entries.length} entries`);
}
