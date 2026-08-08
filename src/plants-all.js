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

// "Alle Pflanzen" sticky badge: show beside BG once the h1 scrolls away
(function () {
  const h1 = document.getElementById('page-title');
  const badge = document.getElementById('plants-all-title-sticky');
  if (!h1 || !badge) return;

  const sentinel = document.createElement('div');
  h1.parentNode.insertBefore(sentinel, h1);

  badge.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  new IntersectionObserver(([e]) => {
    const stuck = !e.isIntersecting && e.boundingClientRect.top < 0;
    badge.classList.toggle('is-visible', stuck);
  }, { threshold: 0 }).observe(sentinel);
})();

// Drop the sticky filter header's top border once it's pinned to the top
(function () {
  const plantsSection = document.getElementById('plants-section');
  const plantHeader = document.querySelector('.plant-sticky-header');
  if (!plantsSection || !plantHeader) return;

  const sentinel = document.createElement('div');
  plantsSection.insertBefore(sentinel, plantHeader);

  new IntersectionObserver(([e]) => {
    const stuck = !e.isIntersecting && e.boundingClientRect.top < 0;
    plantHeader.classList.toggle('is-stuck', stuck);
  }, { threshold: 0 }).observe(sentinel);
})();
