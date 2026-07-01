import { preventPageZoom } from './utils.js';
preventPageZoom();
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm } from './obs-form.js';

const [gardens, observations, plants] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/plants').then(r => r.json()),
]);

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(plants.map(p => [p.slug, p.name]));

document.getElementById('plant-count').textContent = plants.length;

renderPlantList(plants);

document.addEventListener('plant:filter', e => {
  document.getElementById('plant-count').textContent = e.detail.slugs.size;
});

initPlantModal({ gardens, observations, plants });
initObsModal({ gardens, plants });
initObsForm({ gardens, plants, observations });
