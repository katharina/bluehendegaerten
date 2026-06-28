import { renderGardenList } from './gardens.js';
import { renderObsCarousel } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';

const [gardens, observations, customPlants, manifest] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/custom-plants').then(r => r.json()),
  fetch('/plants/manifest.json').then(r => r.json()),
]);

const manifestPlants = [];
const seen = new Set();
for (const p of manifest) {
  if (!seen.has(p.slug)) {
    seen.add(p.slug);
    manifestPlants.push({ ...p, world_w: p.worldW, world_h: p.worldH });
  }
}

const plants = [...customPlants, ...manifestPlants];

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(plants.map(p => [p.slug, p.name]));

renderGardenList(gardens);
renderObsCarousel(observations, gardenMap, plantMap);
renderPlantList(plants);
initPlantModal({ gardens, observations });
