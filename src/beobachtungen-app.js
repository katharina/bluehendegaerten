import { preventPageZoom } from './utils.js';
preventPageZoom();
import { initLazyObsGrid } from './observations.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm } from './obs-form.js';
import { initPlantModal } from './plant-modal.js';

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

const COUNTED_TYPES = ['foto', 'herbarbeleg', 'pflanzenlabel'];

const segments = window.location.pathname.split('/').filter(Boolean);
const slug = segments[1] ?? 'fotos';
let activeType = TYPE_MAP[slug] ?? 'foto';

const params = new URLSearchParams(window.location.search);
const gardenParam = params.get('garden') ?? null;

const [gardens, allPlants] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/plants').then(r => r.json()),
]);

const garden = gardenParam
  ? gardens.find(g => (g.path ?? g.id) === gardenParam || g.id === gardenParam)
  : null;
const gardenId   = garden?.id ?? null;
const gardenSlug = garden ? (garden.path ?? garden.id) : null;

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(allPlants.map(p => [p.slug, p.name]));
const colorMap  = new Map(allPlants.filter(p => p.color).map(p => [p.slug, p.color]));

// Lightweight count-only queries + a small recent sample (for the obs-form's
// "recently used plants" list and as a fallback context) instead of fetching
// every observation up front — the grid itself loads lazily as you scroll.
function countQuery(type) {
  const p = new URLSearchParams({ count: 'true', type });
  if (gardenId) p.set('garden', gardenId);
  return fetch(`/api/observations?${p}`).then(r => r.json()).then(d => d.count).catch(() => 0);
}

const [counts, recentObservations] = await Promise.all([
  Promise.all(COUNTED_TYPES.map(countQuery)),
  fetch(`/api/observations?limit=100${gardenId ? `&garden=${gardenId}` : ''}`).then(r => r.json()).catch(() => []),
]);
const typeCounts = new Map(COUNTED_TYPES.map((t, i) => [t, counts[i]]));

function updateTitle() {
  document.title = `Blühende Gärten - ${TYPE_LABEL[activeType]}${garden ? ' - ' + garden.name : ''}`;
}
updateTitle();

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

let gridCtrl = null;

function loadGrid() {
  gridCtrl = initLazyObsGrid('obs-grid', { gardenMap, plantMap, colorMap, garden: gardenId, type: activeType });
}

function setActiveType(type) {
  activeType = type;
  document.querySelectorAll('.obs-type-tab').forEach(t => t.classList.toggle('is-active', t.dataset.type === type));
  updateTitle();
  loadGrid();
}

document.querySelectorAll('.obs-type-tab').forEach(a => {
  const type = a.dataset.type;
  const typeSlug = type === 'herbarbeleg' ? 'herbar' : type;
  a.href = `/beobachtungen/${typeSlug}${gardenSlug ? `?garden=${gardenSlug}` : ''}`;
  if (type === activeType) a.classList.add('is-active');
  a.hidden = !typeCounts.get(type);
  const countEl = a.querySelector('.obs-type-tab-count');
  if (countEl) countEl.textContent = typeCounts.get(type) || '';

  // Client-side filter switch instead of a full page reload — everything
  // needed is already loaded, so re-navigating just to change the type
  // flashed the whole top nav/pills/counts away and back for no reason.
  a.addEventListener('click', e => {
    if (a.hidden) return;
    e.preventDefault();
    if (type === activeType) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    history.pushState(null, '', a.href);
    setActiveType(type);
  });
});

window.addEventListener('popstate', () => {
  const seg = window.location.pathname.split('/').filter(Boolean);
  activeType = TYPE_MAP[seg[1] ?? 'fotos'] ?? 'foto';
  document.querySelectorAll('.obs-type-tab').forEach(t => t.classList.toggle('is-active', t.dataset.type === activeType));
  updateTitle();
  loadGrid();
});

loadGrid();

const from = parseInt(params.get('from')) || 0;
if (from > 0) gridCtrl.scrollToIndex(from);

initObsModal({ gardens, plants: allPlants });
initObsForm({ gardens, plants: allPlants, observations: recentObservations });
initPlantModal({ gardens, observations: recentObservations, plants: allPlants, gardenId });

function bumpTabCount(type, delta) {
  const tab = document.querySelector(`.obs-type-tab[data-type="${type}"]`);
  if (!tab) return;
  const countEl = tab.querySelector('.obs-type-tab-count');
  const next = Math.max(0, (parseInt(countEl?.textContent) || 0) + delta);
  if (countEl) countEl.textContent = next || '';
  if (delta > 0) tab.hidden = false;
}

const matchesView = o => o.type === activeType && (!gardenId || o.garden === gardenId);

document.addEventListener('obs:saved', e => {
  bumpTabCount(e.detail.type, 1);
  if (matchesView(e.detail)) gridCtrl.prepend(e.detail);
});

document.addEventListener('obs:updated', e => {
  if (matchesView(e.detail)) gridCtrl.update(e.detail);
});

document.addEventListener('obs:deleted', e => {
  if (e.detail.type) bumpTabCount(e.detail.type, -1);
  gridCtrl.remove(e.detail.id);
});
