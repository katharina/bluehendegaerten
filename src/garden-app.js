import { parseCm, preventPageZoom } from './utils.js';
preventPageZoom();
import { renderObsCarousel, renderHerbarCarousel, prependObsToCarousel } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm } from './obs-form.js';
import { renderBedPlan } from './bed-plan.js';
import { initAddPlant } from './add-plant.js';
import { supabase, authedFetch } from './auth.js';

const path = window.location.pathname.split('/').filter(Boolean)[0] ?? '';

const [gardens, allObservations, customPlants, manifest, bedImages, plantInfoAll] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/custom-plants').then(r => r.json()),
  fetch('/plants/manifest.json').then(r => r.json()),
  fetch(`/api/bed-images?garden=${encodeURIComponent(path)}`).then(r => r.json()).catch(() => []),
  fetch('/api/plant-info/all').then(r => r.json()).catch(() => []),
]);

const garden = gardens.find(g => (g.path ?? g.id) === path);
if (!garden) {
  document.getElementById('garden-name').textContent = 'Garten nicht gefunden';
  throw new Error(`No garden found for path: ${path}`);
}

document.getElementById('garden-name').textContent = garden.name;
document.title = `${garden.name} — Blühende Gärten`;

// Build plant lookup: custom plants base, manifest fills the rest,
// plant_info overrides color/world_w as the authoritative DB source
const plantInfoMap = new Map(plantInfoAll.map(p => [p.slug, p]));

const manifestPlants = [];
const seen = new Set(customPlants.map(p => p.slug));
for (const p of manifest) {
  if (!seen.has(p.slug)) {
    seen.add(p.slug);
    manifestPlants.push({ slug: p.slug, name: p.name, name_de: p.name_de, family: p.family });
  }
}
const allPlants = [...customPlants, ...manifestPlants].map(p => {
  const info = plantInfoMap.get(p.slug);
  if (!info) return p;
  const world_w = info.world_w
    ? parseFloat(info.world_w)
    : info.breite ? parseCm(info.breite) / 100 : null;
  return {
    ...p,
    ...(info.color ? { color: info.color } : {}),
    ...(world_w    ? { world_w }           : {}),
  };
});
const plantBySlug = new Map(allPlants.map(p => [p.slug, p]));

// Fetch plan upfront so we know all placement slugs
const planData = await fetch(`/api/plans/${garden.id}`).then(r => r.json()).catch(() => null);

let placements = [];
let planStore  = null;
if (planData?.data) {
  try {
    planStore = JSON.parse(planData.data);
    const ver = planStore.versions?.find(v => v.id === planStore.currentId) ?? planStore.versions?.[0];
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

const layout = document.querySelector('.garden-layout');
if (placements.length || garden.has_plan) {
  layout.classList.add('has-bed');
} else {
  layout.classList.add('no-bed');
}
layout.addEventListener('mousemove', () => layout.classList.add('is-interactive'), { once: true });

// Bed name — editable when logged in
const bedNameEl = document.getElementById('bed-name');
if (planStore?.bedName) bedNameEl.textContent = planStore.bedName;

// ── Edit mode ─────────────────────────────────────────────────────────────────
let editMode = false;
let selectedSlug = null;

function getStore() {
  if (!planStore) planStore = { versions: [{ id: 'default', name: 'Version 1', placements: [] }], currentId: 'default' };
  if (!planStore.versions[0].name) planStore.versions[0].name = 'Version 1';
  return planStore;
}
function getActivePlacements() {
  const store = getStore();
  const ver = store.versions?.find(v => v.id === store.currentId) ?? store.versions?.[0];
  if (!ver.placements) ver.placements = [];
  return ver.placements;
}

async function savePlan() {
  const store = getStore();
  await authedFetch(`/api/plans/${garden.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: JSON.stringify(store) }),
  }).catch(() => {});
}

function getActiveVersion() {
  const store = getStore();
  return store.versions?.find(v => v.id === store.currentId) ?? store.versions?.[0];
}

function renderVersionSelect() {
  const store = getStore();
  const sel = document.getElementById('version-select');
  sel.innerHTML = store.versions.map(v =>
    `<option value="${v.id}"${v.id === store.currentId ? ' selected' : ''}>${v.name ?? 'Version'}</option>`
  ).join('');
}

function rerenderBedPlan() {
  renderBedPlan(document.getElementById('bed-plan'), {
    plants: allPlants,
    bedImages: bedImageMap,
    placements: getActivePlacements(),
    bedConfig: getStore().bedConfig ?? null,
    editMode,
    selectedSlug,
    onPlace(slug, x, z) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      getActivePlacements().push({ id, slug, x: +x.toFixed(3), z: +z.toFixed(3) });
      savePlan();
      rerenderBedPlan();
    },
    onRemove(id) {
      const arr = getActivePlacements();
      const idx = arr.findIndex(p => p.id === id);
      if (idx !== -1) arr.splice(idx, 1);
      savePlan();
      rerenderBedPlan();
    },
    async onUploadBed(bedIndex) {
      _uploadBedIndex = bedIndex;
      document.getElementById('bed-img-input').click();
    },
  });
}

function setSelectedSlug(slug) {
  selectedSlug = slug;
  document.querySelectorAll('.plant-card').forEach(c => {
    c.classList.toggle('is-selected', c.dataset.slug === slug);
  });
  rerenderBedPlan();
}

let _uploadBedIndex = null;
const bedImgInput = document.getElementById('bed-img-input');
bedImgInput.addEventListener('change', async () => {
  const file = bedImgInput.files[0];
  if (!file || _uploadBedIndex === null) return;
  try {
    const { url, key } = await authedFetch('/api/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: file.type, filename: file.name }),
    }).then(r => r.json());
    await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    await authedFetch('/api/bed-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garden: garden.id, bed_index: _uploadBedIndex, filename: key }),
    });
    bedImageMap[_uploadBedIndex] = key;
    rerenderBedPlan();
  } catch {}
  bedImgInput.value = '';
  _uploadBedIndex = null;
});

supabase.auth.getSession().then(({ data: { session } }) => {
  if (!session?.user) return;

  // Bed name editable
  bedNameEl.contentEditable = 'true';
  bedNameEl.addEventListener('blur', async () => {
    const name = bedNameEl.textContent.trim() || 'Beete';
    bedNameEl.textContent = name;
    getStore().bedName = name;
    await savePlan();
  });
  bedNameEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); bedNameEl.blur(); }
  });

  // Version management
  const versionBar = document.getElementById('bed-version-bar');
  const versionSel = document.getElementById('version-select');

  renderVersionSelect();

  versionSel.addEventListener('change', () => {
    getStore().currentId = versionSel.value;
    savePlan();
    rerenderBedPlan();
  });

  document.getElementById('version-copy-btn').addEventListener('click', () => {
    const store = getStore();
    const current = getActiveVersion();
    const date = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: 'numeric' });
    const newVer = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      name: `Kopie ${date}`,
      placements: JSON.parse(JSON.stringify(current.placements ?? [])),
    };
    store.versions.push(newVer);
    store.currentId = newVer.id;
    savePlan();
    renderVersionSelect();
    rerenderBedPlan();
  });

  document.getElementById('bed-config-btn').addEventListener('click', () => {
    const store = getStore();
    const cfg = store.bedConfig ?? {};
    const l = prompt('Beetlänge (Meter):', cfg.bedL ?? 9);
    if (l === null) return;
    const w = prompt('Beetbreiten, kommagetrennt (Meter):', (cfg.bedWidths ?? [1.5, 1.5, 1.5, 1.5, 3.0, 1.5, 1.5, 1.5, 3.0]).join(', '));
    if (w === null) return;
    const bedWidths = w.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0);
    if (!bedWidths.length) return;
    store.bedConfig = { bedL: parseFloat(l) || 9, bedWidths };
    savePlan();
    rerenderBedPlan();
  });

  // Edit mode toggle
  const editBtn = document.getElementById('bed-edit-btn');
  editBtn.hidden = false;
  editBtn.addEventListener('click', () => {
    editMode = !editMode;
    editBtn.textContent = editMode ? 'Fertig' : 'Bearbeiten';
    editBtn.classList.toggle('is-active', editMode);
    versionBar.hidden = !editMode;
    document.getElementById('bed-config-btn').hidden = !editMode;
    if (editMode) {
      renderVersionSelect();
    } else {
      selectedSlug = null;
      document.querySelectorAll('.plant-card.is-selected').forEach(c => c.classList.remove('is-selected'));
    }
    rerenderBedPlan();
  });

  // In edit mode, intercept plant:open to select the plant instead of opening the modal
  document.addEventListener('plant:open', e => {
    if (!editMode) return;
    e.stopImmediatePropagation();
    setSelectedSlug(selectedSlug === e.detail.slug ? null : e.detail.slug);
  }, true);
});

const gardenObsLabelled = gardenObs.map(o => ({ ...o, place: garden.name }));
renderObsCarousel(gardenObsLabelled, gardenMap, plantMap);
renderHerbarCarousel(gardenObsLabelled, gardenMap, plantMap);
const bedSlugs = placements.length ? new Set(placements.map(p => p.slug)) : null;
renderPlantList(gardenPlants, { bedSlugs });
rerenderBedPlan();

initPlantModal({ gardens, observations: allObservations, plants: allPlants, gardenId: garden.id });
initObsModal({ gardens, plants: allPlants });
initObsForm({ gardens, plants: allPlants, gardenId: garden.id, observations: allObservations });
initAddPlant({
  onAdded(plant) {
    allPlants.push(plant);
    gardenPlants.push(plant);
    renderPlantList(gardenPlants, { bedSlugs });
  },
});

document.addEventListener('obs:saved', e => {
  const obs = { ...e.detail, place: garden.name };
  prependObsToCarousel(obs, gardenMap, plantMap);
});

// Lock panels open on click; release by clicking col 1
const panels   = document.querySelector('.garden-panels');
const gardenCol = document.querySelector('.garden-col--garden');
panels.addEventListener('click', () => panels.classList.add('is-expanded'));
gardenCol.addEventListener('click', () => panels.classList.remove('is-expanded'));
