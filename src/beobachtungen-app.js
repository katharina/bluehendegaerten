import { preventPageZoom } from './utils.js';
preventPageZoom();
import { renderObsGrid } from './observations.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm } from './obs-form.js';

const TYPE_MAP = {
  fotos:          'foto',
  herbar:         'herbarbeleg',
  pflanzenlabel:  'pflanzenlabel',
  notiz:          'notiz',
};

const TYPE_LABEL = {
  foto:           'Fotos',
  herbarbeleg:    'Herbarbelege',
  pflanzenlabel:  'Pflanzenlabels',
  notiz:          'Notizen',
};

const segments = window.location.pathname.split('/').filter(Boolean);
const slug = segments[1] ?? 'fotos';
const activeType = TYPE_MAP[slug] ?? 'foto';

const params = new URLSearchParams(window.location.search);
const gardenParam = params.get('garden') ?? null;

const [gardens, allObservations, allPlants] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/plants').then(r => r.json()),
]);

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(allPlants.map(p => [p.slug, p.name]));
const colorMap  = new Map(allPlants.filter(p => p.color).map(p => [p.slug, p.color]));

const garden = gardenParam
  ? gardens.find(g => (g.path ?? g.id) === gardenParam || g.id === gardenParam)
  : null;
const gardenId   = garden?.id ?? null;
const gardenSlug = garden ? (garden.path ?? garden.id) : null;

// Garden name badge
const gardenBadge = document.getElementById('garden-name-sticky');
if (garden) {
  gardenBadge.href = '/' + gardenSlug;
  gardenBadge.textContent = garden.name;
  gardenBadge.hidden = false;
  gardenBadge.classList.add('is-visible');
}

document.getElementById('obs-grid')?.classList.toggle('is-garden-scoped', !!garden);

// "Beobachtungen" sticky badge: show beside BG+garden name once the h1 scrolls away
(function () {
  const h1 = document.getElementById('page-title');
  const badge = document.getElementById('obs-title-sticky');
  if (!h1 || !badge) return;

  const sentinel = document.createElement('div');
  h1.parentNode.insertBefore(sentinel, h1);

  badge.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;
  const gardenNameWords = garden ? garden.name.trim().split(/\s+/) : [];
  const gardenNameInitials = garden ? (gardenNameWords.length > 1
    ? gardenNameWords.map(w => w[0]).join('')
    : gardenNameWords[0].slice(0, 3)
  ).toUpperCase() : '';

  new IntersectionObserver(([e]) => {
    const stuck = !e.isIntersecting && e.boundingClientRect.top < 0;
    badge.classList.toggle('is-visible', stuck);
    if (garden) gardenBadge.textContent = (stuck && isMobile()) ? gardenNameInitials : garden.name;
  }, { threshold: 0 }).observe(sentinel);
})();

// Tab links — preserve garden param, hide types with no observations
const gardenScopedObs = gardenId ? allObservations.filter(o => o.garden === gardenId) : allObservations;
const existingTypes = new Set(gardenScopedObs.map(o => o.type));

document.querySelectorAll('.obs-type-tab').forEach(a => {
  const type = a.dataset.type;
  const typeSlug = type === 'herbarbeleg' ? 'herbar' : type;
  a.href = `/beobachtungen/${typeSlug}${gardenSlug ? `?garden=${gardenSlug}` : ''}`;
  if (type === activeType) a.classList.add('is-active');
  a.hidden = !existingTypes.has(type);
});

// Filter obs
let obs = allObservations.filter(o => o.type === activeType);
if (gardenId) obs = obs.filter(o => o.garden === gardenId);
obs = obs
  .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

renderObsGrid(obs, gardenMap, plantMap, 'obs-grid', colorMap);

const from = parseInt(params.get('from')) || 0;
if (from > 0) {
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('#obs-grid .carousel-card');
    cards[from]?.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
}

initObsModal({ gardens, plants: allPlants });
initObsForm({ gardens, plants: allPlants, observations: allObservations });

document.addEventListener('obs:saved', e => {
  allObservations.push(e.detail);
  let updated = allObservations.filter(o => o.type === activeType);
  if (gardenId) updated = updated.filter(o => o.garden === gardenId);
  updated = updated
    .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderObsGrid(updated, gardenMap, plantMap, 'obs-grid', colorMap);
});

document.addEventListener('obs:updated', e => {
  const idx = allObservations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) allObservations[idx] = { ...allObservations[idx], ...e.detail };
  let updated = allObservations.filter(o => o.type === activeType);
  if (gardenId) updated = updated.filter(o => o.garden === gardenId);
  updated = updated
    .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderObsGrid(updated, gardenMap, plantMap, 'obs-grid', colorMap);
});

document.addEventListener('obs:deleted', e => {
  const idx = allObservations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) allObservations.splice(idx, 1);
  let updated = allObservations.filter(o => o.type === activeType);
  if (gardenId) updated = updated.filter(o => o.garden === gardenId);
  updated = updated
    .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderObsGrid(updated, gardenMap, plantMap, 'obs-grid', colorMap);
});
