import { preventPageZoom } from './utils.js';
preventPageZoom();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
import { renderGardenList } from './gardens.js';
import { initLazyObsCarousel, prependObsToCarousel, updateObsInCarousel, removeObsFromCarousel, setCurrentUser } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm, addPlantToObsForm, openObsForm } from './obs-form.js';
import { initAddPlant } from './add-plant.js';
import { supabase } from './auth.js';

const [[gardens, plants, observedSlugs], { data: { session } }] = await Promise.all([
  Promise.all([
    fetch('/api/gardens').then(r => r.json()),
    fetch('/api/plants').then(r => r.json()),
    fetch('/api/plants/observed').then(r => r.json()).catch(() => null),
  ]),
  supabase.auth.getSession(),
]);
const obsSlugSet = Array.isArray(observedSlugs) && observedSlugs.length ? new Set(observedSlugs) : null;

setCurrentUser(session?.user?.id ?? null);

const gardenMap   = new Map(gardens.map(g => [g.id, g.name]));
const plantMap    = new Map(plants.map(p => [p.slug, p.name]));
const colorMap    = new Map(plants.filter(p => p.color).map(p => [p.slug, p.color]));

const observations = []; // populated lazily as carousel loads

function updateCounts() {
  const pe = document.getElementById('plant-count');
  if (pe) pe.textContent = obsSlugSet ? plants.filter(p => obsSlugSet.has(p.slug)).length : plants.length;
}

renderGardenList(gardens);

document.getElementById('join-cta')?.addEventListener('click', e => {
  e.preventDefault();
  openObsForm({});
});

document.addEventListener('plant:filter', e => {
  const pe = document.getElementById('plant-count');
  if (pe) pe.textContent = e.detail.slugs.size;
  const badge = document.getElementById('plant-count-sticky');
  if (badge) badge.textContent = `${e.detail.slugs.size} Pflanzen`;
});

initLazyObsCarousel('obs-carousel', { gardenMap, plantMap, colorMap, sharedList: observations, onLoad: updateCounts, maxBatches: 3, showAllHref: '/beobachtungen/fotos' });
initLazyObsCarousel('herbar-carousel', { gardenMap, plantMap, colorMap, sharedList: [], type: 'herbarbeleg', sectionId: 'herbar-section', showAllHref: '/beobachtungen/herbar' });
renderPlantList(plants, { obsSlugSet });
updateCounts();

initPlantModal({ gardens, observations, plants });
initObsModal({ gardens, plants, showAllHref: '/beobachtungen/fotos' });
initObsForm({ gardens, plants, observations });

document.getElementById('quick-herbar-btn')?.addEventListener('click', () => {
  document.dispatchEvent(new CustomEvent('obs:new', { detail: { type: 'herbarbeleg' } }));
});
initAddPlant({
  onAdded(plant) {
    plants.push(plant);
    addPlantToObsForm(plant);
    renderPlantList(plants, { obsSlugSet });
  },
});

document.addEventListener('obs:saved', e => {
  observations.push(e.detail);
  prependObsToCarousel(e.detail, gardenMap, plantMap);
  updateCounts();
});

document.addEventListener('obs:updated', e => {
  const idx = observations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) observations[idx] = { ...observations[idx], ...e.detail };
  updateObsInCarousel(e.detail, gardenMap, plantMap);
});

document.addEventListener('obs:deleted', e => {
  const idx = observations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) observations.splice(idx, 1);
  removeObsFromCarousel(e.detail.id);
  updateCounts();
});

document.addEventListener('plant:updated', e => {
  const idx = plants.findIndex(p => p.slug === e.detail.slug);
  if (idx !== -1) { plants[idx] = { ...plants[idx], ...e.detail }; renderPlantList(plants, { obsSlugSet }); }
});

// BG square: show when h1 scrolls out of view; click scrolls to top
(function () {
  const h1 = document.querySelector('.highlight-header h1');
  const bgSquare = document.querySelector('.highlight-sticky');
  if (!h1 || !bgSquare) return;

  new IntersectionObserver(([e]) => {
    bgSquare.classList.toggle('is-visible', !e.isIntersecting);
  }, { threshold: 0 }).observe(h1);

  bgSquare.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

// Plant count badge: show beside BG square when filter header is stuck
(function () {
  const plantsSection = document.getElementById('plants-section');
  const plantHeader = document.querySelector('.plant-sticky-header');
  const badge = document.getElementById('plant-count-sticky');
  if (!plantsSection || !plantHeader || !badge) return;

  const sentinel = document.createElement('div');
  plantsSection.insertBefore(sentinel, plantHeader);

  new IntersectionObserver(([e]) => {
    const stuck = !e.isIntersecting && e.boundingClientRect.top < 0;
    badge.classList.toggle('is-visible', stuck);
    plantHeader.classList.toggle('is-stuck', stuck);
  }, { threshold: 0 }).observe(sentinel);
})();
