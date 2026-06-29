import { preventPageZoom } from './utils.js';
preventPageZoom();
import { renderGardenList } from './gardens.js';
import { renderObsCarousel, prependObsToCarousel, updateObsInCarousel, removeObsFromCarousel } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm } from './obs-form.js';
import { initAddPlant } from './add-plant.js';

const [gardens, observations, plants] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/plants').then(r => r.json()),
]);

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(plants.map(p => [p.slug, p.name]));

const obsSlugSet = new Set(observations.flatMap(o => o.slugs ?? []));

function updateCounts() {
  document.getElementById('obs-count').textContent  = observations.filter(o => o.filename).length;
  document.getElementById('plant-count').textContent = plants.filter(p => obsSlugSet.has(p.slug)).length;
}

renderGardenList(gardens, observations);
renderObsCarousel(observations, gardenMap, plantMap);
renderPlantList(plants, { obsSlugSet });
updateCounts();

initPlantModal({ gardens, observations, plants });
initObsModal({ gardens, plants });
initObsForm({ gardens, plants, observations });
initAddPlant({
  onAdded(plant) {
    plants.push(plant);
    renderPlantList(plants, { obsSlugSet });
  },
});

document.addEventListener('obs:saved', e => {
  observations.push(e.detail);
  (e.detail.slugs ?? []).forEach(s => obsSlugSet.add(s));
  prependObsToCarousel(e.detail, gardenMap, plantMap);
  renderPlantList(plants, { obsSlugSet });
  updateCounts();
});

document.addEventListener('obs:updated', e => {
  const idx = observations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) observations[idx] = { ...observations[idx], ...e.detail };
  (e.detail.slugs ?? []).forEach(s => obsSlugSet.add(s));
  updateObsInCarousel(e.detail, gardenMap, plantMap);
  renderPlantList(plants, { obsSlugSet });
});

document.addEventListener('obs:deleted', e => {
  const idx = observations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) observations.splice(idx, 1);
  obsSlugSet.clear();
  observations.forEach(o => (o.slugs ?? []).forEach(s => obsSlugSet.add(s)));
  removeObsFromCarousel(e.detail.id);
  renderPlantList(plants, { obsSlugSet });
  updateCounts();
});

document.addEventListener('plant:updated', e => {
  const idx = plants.findIndex(p => p.slug === e.detail.slug);
  if (idx !== -1) { plants[idx] = { ...plants[idx], ...e.detail }; renderPlantList(plants, { obsSlugSet }); }
});

