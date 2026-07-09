import { preventPageZoom } from './utils.js';
preventPageZoom();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
import { renderGardenList } from './gardens.js';
import { initLazyObsCarousel, prependObsToCarousel, updateObsInCarousel, removeObsFromCarousel, setCurrentUser } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm, addPlantToObsForm } from './obs-form.js';
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

fetch('/api/observations?count=true')
  .then(r => r.json())
  .then(({ count }) => {
    const el = document.getElementById('obs-count');
    if (el) el.textContent = count;
  })
  .catch(() => {});

function updateCounts() {
  const pe = document.getElementById('plant-count');
  if (pe) pe.textContent = obsSlugSet ? plants.filter(p => obsSlugSet.has(p.slug)).length : plants.length;
}

renderGardenList(gardens);


initLazyObsCarousel('obs-carousel', { gardenMap, plantMap, colorMap, sharedList: observations, onLoad: updateCounts, maxBatches: 3, showAllHref: '/beobachtungen/fotos' });
renderPlantList(plants, { obsSlugSet });
updateCounts();

initPlantModal({ gardens, observations, plants });
initObsModal({ gardens, plants, showAllHref: '/beobachtungen/fotos' });
initObsForm({ gardens, plants, observations });
initAddPlant({
  onAdded(plant) {
    plants.push(plant);
    addPlantToObsForm(plant);
    renderPlantList(plants, { obsSlugSet });
  },
});

document.addEventListener('plant:filter', e => {
  const pe = document.getElementById('plant-count');
  if (pe) pe.textContent = e.detail.slugs.size;
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

// Plant sticky header: black rectangle when stuck, beside highlight-sticky on mobile
(function () {
  const plantHeader = document.querySelector('.plant-sticky-header');
  const plantsSection = document.getElementById('plants-section');
  const highlightSticky = document.querySelector('.highlight-sticky');
  if (!plantHeader || !plantsSection) return;

  const sentinel = document.createElement('div');
  plantsSection.insertBefore(sentinel, plantHeader);

  let spacer = null;
  let isStuck = false;
  let currentObs = null;

  function setStuck(stuck) {
    if (stuck === isStuck) return;
    isStuck = stuck;

    if (stuck) {
      const h = plantHeader.offsetHeight;
      plantHeader.classList.add('is-stuck');
      if (!spacer) { spacer = document.createElement('div'); plantHeader.after(spacer); }
      spacer.style.height = h + 'px';
      spacer.hidden = false;
      const hs = highlightSticky?.getBoundingClientRect();
      plantHeader.style.left = `${(hs?.width > 0 ? hs.right : 16) + 12}px`;
    } else {
      plantHeader.classList.remove('is-stuck');
      plantHeader.style.left = '';
      if (spacer) spacer.hidden = true;
    }
  }

  function setup() {
    currentObs?.disconnect();
    isStuck = false;
    plantHeader.classList.remove('is-stuck');
    plantHeader.style.left = '';
    if (spacer) spacer.hidden = true;
    if (window.innerWidth >= 900) return; // desktop: no stuck behavior
    currentObs = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 });
    currentObs.observe(sentinel);
  }

  setup();
  window.addEventListener('resize', setup, { passive: true });
})();
