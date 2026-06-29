import { parseCm, preventPageZoom } from './utils.js';
preventPageZoom();
import { renderGardenList } from './gardens.js';
import { renderObsCarousel, prependObsToCarousel } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm } from './obs-form.js';
import { initAddPlant } from './add-plant.js';

const [gardens, observations, customPlants, manifest, plantInfoAll] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/custom-plants').then(r => r.json()),
  fetch('/plants/manifest.json').then(r => r.json()),
  fetch('/api/plant-info/all').then(r => r.json()).catch(() => []),
]);

const plantInfoMap = new Map(plantInfoAll.map(p => [p.slug, p]));

const manifestPlants = [];
const seen = new Set(customPlants.map(p => p.slug));
for (const p of manifest) {
  if (!seen.has(p.slug)) {
    seen.add(p.slug);
    manifestPlants.push({ slug: p.slug, name: p.name, name_de: p.name_de, family: p.family });
  }
}

const plants = [...customPlants, ...manifestPlants].map(p => {
  const info = plantInfoMap.get(p.slug);
  if (!info) return p;
  const world_w = info.world_w
    ? parseFloat(info.world_w)
    : info.breite ? parseCm(info.breite) / 100 : null;
  return {
    ...p,
    ...(info.color ? { color: info.color } : {}),
    ...(world_w    ? { world_w }           : {}),
  };
});

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(plants.map(p => [p.slug, p.name]));

renderGardenList(gardens);
renderObsCarousel(observations, gardenMap, plantMap);
renderPlantList(plants);

const obsWithImg = observations.filter(o => o.filename).length;
document.getElementById('obs-count').textContent = obsWithImg;
document.getElementById('plant-count').textContent = plants.length;
initPlantModal({ gardens, observations });
initObsModal({ gardens, plants });
initObsForm({ gardens, plants, observations });
initAddPlant({
  onAdded(plant) {
    plants.push(plant);
    renderPlantList(plants);
    document.getElementById('plant-count').textContent = plants.length;
  },
});

document.addEventListener('obs:saved', e => {
  prependObsToCarousel(e.detail, gardenMap, plantMap);
});
