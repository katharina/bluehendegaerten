import { renderObsCarousel } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { renderBedPlan } from './bed-plan.js';

const path = window.location.pathname.split('/').filter(Boolean)[0] ?? '';

const [gardens, allObservations, customPlants, manifest, bedImages] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/custom-plants').then(r => r.json()),
  fetch('/plants/manifest.json').then(r => r.json()),
  fetch(`/api/bed-images?garden=${encodeURIComponent(path)}`).then(r => r.json()).catch(() => []),
]);

const garden = gardens.find(g => (g.path ?? g.id) === path);
if (!garden) {
  document.getElementById('garden-name').textContent = 'Garten nicht gefunden';
  throw new Error(`No garden found for path: ${path}`);
}

document.getElementById('garden-name').textContent = garden.name;
document.title = `${garden.name} — Blühende Gärten`;

// Build plant lookup: custom plants take precedence over manifest
const manifestPlants = [];
const seen = new Set(customPlants.map(p => p.slug));
for (const p of manifest) {
  if (!seen.has(p.slug)) {
    seen.add(p.slug);
    manifestPlants.push({ ...p, world_w: p.worldW, world_h: p.worldH });
  }
}
const allPlants = [...customPlants, ...manifestPlants];
const plantBySlug = new Map(allPlants.map(p => [p.slug, p]));

// Fetch plan upfront so we know all placement slugs
const planData = await fetch(`/api/plans/${garden.id}`).then(r => r.json()).catch(() => null);

let placements = [];
if (planData?.data) {
  try {
    const store = JSON.parse(planData.data);
    const ver = store.versions?.find(v => v.id === store.currentId) ?? store.versions?.[0];
    placements = ver?.placements ?? [];
  } catch {}
}

// Collect all relevant slugs: garden list + plan placements + garden obs
const relevantSlugs = new Set(garden.plants ?? []);
for (const p of placements) relevantSlugs.add(p.slug);

const gardenObs = allObservations.filter(o => o.garden === garden.id);
for (const o of gardenObs) {
  for (const slug of (o.slugs ?? [])) relevantSlugs.add(slug);
}

const gardenPlants = [...relevantSlugs]
  .map(slug => plantBySlug.get(slug))
  .filter(Boolean);

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(allPlants.map(p => [p.slug, p.name]));
const bedImageMap = Object.fromEntries(bedImages.map(b => [b.bed_index, b.filename]));

renderObsCarousel(gardenObs, gardenMap, plantMap);
renderPlantList(gardenPlants);
renderBedPlan(document.getElementById('bed-plan'), {
  plants: allPlants,
  bedImages: bedImageMap,
  placements,
});

initPlantModal({ gardens, observations: allObservations, gardenId: garden.id });
initObsModal({ gardens, plants: allPlants });

// Lock panels open on click; release by clicking col 1
const panels   = document.querySelector('.garden-panels');
const gardenCol = document.querySelector('.garden-col--garden');
panels.addEventListener('click', () => panels.classList.add('is-expanded'));
gardenCol.addEventListener('click', () => panels.classList.remove('is-expanded'));
