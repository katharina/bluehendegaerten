// Single source of truth for manifest generation.
// Both generate.js and process-existing.js import this.

import { writeFileSync } from 'fs';
import { join } from 'path';

export function writeManifest(species, outDir) {
  const entries = [];
  for (const plant of species) {
    const worldW = plant.width_cm / 100;
    const worldH = plant.height_cm / 100;
    for (const stage of plant.stages) {
      const entry = {
        slug:    plant.slug,
        name:    plant.name,
        name_de: plant.name_de ?? null,
        color:   plant.color   ?? null,
        stage:   stage.id,
        months:  stage.months,
        worldW,
        worldH,
        density: plant.density,
        seed:    plant.scatter_seed,
      };
      if (plant.beds) entry.beds = plant.beds;
      entries.push(entry);
    }
  }
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(entries, null, 2));
  console.log(`  manifest → ${entries.length} entries`);
}
