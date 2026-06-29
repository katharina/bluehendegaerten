import { preventPageZoom } from './utils.js';
preventPageZoom();
import { renderGardenList } from './gardens.js';
import { renderObsCarousel, prependObsToCarousel } from './observations.js';
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

renderGardenList(gardens);
renderObsCarousel(observations, gardenMap, plantMap);
renderPlantList(plants);

const obsWithImg = observations.filter(o => o.filename).length;
document.getElementById('obs-count').textContent = obsWithImg;
document.getElementById('plant-count').textContent = plants.length;
initPlantModal({ gardens, observations, plants });
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
