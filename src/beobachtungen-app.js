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
const gardenId = params.get('garden') ?? null;

const [gardens, allObservations, allPlants] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/plants').then(r => r.json()),
]);

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(allPlants.map(p => [p.slug, p.name]));

const garden = gardenId ? gardens.find(g => g.id === gardenId) : null;

// Page title
const titleEl = document.getElementById('page-title');
if (garden) {
  titleEl.textContent = garden.name;
  const backLink = document.getElementById('back-link');
  backLink.href = '/' + (garden.path ?? garden.id);
  backLink.textContent = garden.name;
}

// Tab links — preserve garden param
document.querySelectorAll('.obs-type-tab').forEach(a => {
  const type = a.dataset.type;
  const typeSlug = type === 'herbarbeleg' ? 'herbar' : type;
  a.href = `/beobachtungen/${typeSlug}${gardenId ? `?garden=${gardenId}` : ''}`;
  if (type === activeType) a.classList.add('is-active');
});

// Filter obs
let obs = allObservations.filter(o => o.type === activeType);
if (gardenId) obs = obs.filter(o => o.garden === gardenId);
obs = obs
  .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

renderObsGrid(obs, gardenMap, plantMap, 'obs-grid');

initObsModal({ gardens, plants: allPlants });
initObsForm({ gardens, plants: allPlants, observations: allObservations });

document.addEventListener('obs:saved', e => {
  allObservations.push(e.detail);
  let updated = allObservations.filter(o => o.type === activeType);
  if (gardenId) updated = updated.filter(o => o.garden === gardenId);
  updated = updated
    .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderObsGrid(updated, gardenMap, plantMap, 'obs-grid');
});

document.addEventListener('obs:updated', e => {
  const idx = allObservations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) allObservations[idx] = { ...allObservations[idx], ...e.detail };
  let updated = allObservations.filter(o => o.type === activeType);
  if (gardenId) updated = updated.filter(o => o.garden === gardenId);
  updated = updated
    .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderObsGrid(updated, gardenMap, plantMap, 'obs-grid');
});

document.addEventListener('obs:deleted', e => {
  const idx = allObservations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) allObservations.splice(idx, 1);
  let updated = allObservations.filter(o => o.type === activeType);
  if (gardenId) updated = updated.filter(o => o.garden === gardenId);
  updated = updated
    .map(o => ({ ...o, place: gardenMap.get(o.garden) || o.place || '' }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderObsGrid(updated, gardenMap, plantMap, 'obs-grid');
});
