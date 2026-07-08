import { preventPageZoom } from './utils.js';
preventPageZoom();
import { renderGardenList } from './gardens.js';
import { initLazyObsCarousel, prependObsToCarousel, updateObsInCarousel, removeObsFromCarousel, setCurrentUser } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm, addPlantToObsForm } from './obs-form.js';
import { initAddPlant } from './add-plant.js';
import { supabase } from './auth.js';

const [[gardens, plants], { data: { session } }] = await Promise.all([
  Promise.all([
    fetch('/api/gardens').then(r => r.json()),
    fetch('/api/plants').then(r => r.json()),
  ]),
  supabase.auth.getSession(),
]);

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
  if (pe) pe.textContent = plants.length;
}

renderGardenList(gardens, []);

const plantSentinel = document.querySelector('.plant-sticky-sentinel');
const plantStickyHeader = document.querySelector('.plant-sticky-header');
if (plantSentinel && plantStickyHeader) {
  const bgBox = document.querySelector('.highlight-sticky');
  if (bgBox && window.matchMedia('(max-width: 640px)').matches) {
    const offset = bgBox.offsetWidth + 8;
    plantStickyHeader.style.setProperty('--pflanzen-left', `calc(var(--page-pad) + ${offset}px)`);
  }
  const sidebar = plantStickyHeader.closest('.homepage-sidebar');
  const scrollRoot = sidebar && getComputedStyle(sidebar).overflowY === 'auto' ? sidebar : null;

  function updateStuck() {
    const containerTop = scrollRoot ? scrollRoot.getBoundingClientRect().top : 0;
    const sectionTop = document.getElementById('plants-section').getBoundingClientRect().top;
    plantStickyHeader.classList.toggle('is-stuck', sectionTop < containerTop);
  }
  (scrollRoot ?? window).addEventListener('scroll', updateStuck, { passive: true });
  window.visualViewport?.addEventListener('resize', updateStuck);
  updateStuck();

  plantStickyHeader.addEventListener('click', () => {
    if (!plantStickyHeader.classList.contains('is-stuck')) return;
    if (scrollRoot) {
      const top = scrollRoot.scrollTop + plantSentinel.getBoundingClientRect().top - scrollRoot.getBoundingClientRect().top + 1;
      scrollRoot.scrollTo({ top, behavior: 'smooth' });
    } else {
      const top = window.scrollY + plantSentinel.getBoundingClientRect().top + 1;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
}
initLazyObsCarousel('obs-carousel', { gardenMap, plantMap, colorMap, sharedList: observations, onLoad: updateCounts, maxBatches: 3, showAllHref: '/beobachtungen/fotos' });
renderPlantList(plants, {});
updateCounts();

initPlantModal({ gardens, observations, plants });
initObsModal({ gardens, plants, showAllHref: '/beobachtungen/fotos' });
initObsForm({ gardens, plants, observations });
initAddPlant({
  onAdded(plant) {
    plants.push(plant);
    addPlantToObsForm(plant);
    renderPlantList(plants, {});
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
  if (idx !== -1) { plants[idx] = { ...plants[idx], ...e.detail }; renderPlantList(plants, {}); }
});

