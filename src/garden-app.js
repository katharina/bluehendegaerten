import { preventPageZoom } from './utils.js';
preventPageZoom();
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
import { initLazyObsCarousel, renderNotizCarousel, prependObsToCarousel, updateObsInCarousel, removeObsFromCarousel, setCurrentUser } from './observations.js';
import { renderPlantList } from './plants.js';
import { initPlantModal } from './plant-modal.js';
import { initObsModal } from './obs-modal.js';
import { initObsForm, addPlantToObsForm } from './obs-form.js';
import { renderBedPlan } from './bed-plan.js';
import { initAddPlant } from './add-plant.js';
import { supabase, authedFetch } from './auth.js';

const path = window.location.pathname.split('/').filter(Boolean)[0] ?? '';

const [gardens, allObservations, allPlants, bedImages] = await Promise.all([
  fetch('/api/gardens').then(r => r.json()),
  fetch('/api/observations').then(r => r.json()),
  fetch('/api/plants').then(r => r.json()),
  fetch(`/api/bed-images?garden=${encodeURIComponent(path)}`).then(r => r.json()).catch(() => []),
]);

const garden = gardens.find(g => (g.path ?? g.id) === path);
if (!garden) {
  document.getElementById('garden-name').textContent = 'Garten nicht gefunden';
  throw new Error(`No garden found for path: ${path}`);
}

document.getElementById('garden-name').innerHTML = garden.name.replace(/ /g, '<br>');
document.title = `${garden.name} — Blühende Gärten`;
document.getElementById('garden-intro-title').textContent = garden.name;
document.getElementById('garden-intro-text').textContent = garden.description
  || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.';

// ── Garden name sticky badge ───────────────────────────────────────────────────
const gardenNameBadge = document.getElementById('garden-name-sticky');
const gardenNameWords = garden.name.trim().split(/\s+/);
const gardenNameInitials = (gardenNameWords.length > 1
  ? gardenNameWords.map(w => w[0]).join('')
  : gardenNameWords[0].slice(0, 3)
).toUpperCase();
gardenNameBadge.textContent = garden.name;
const gardenColEl = document.querySelector('.garden-col--garden');
const gardenTitleEl = document.getElementById('garden-name');
const gardenIsScrollContainer = gardenColEl && getComputedStyle(gardenColEl).overflowY === 'auto';
const gardenScrollEl = gardenIsScrollContainer ? gardenColEl : window;
function updateGardenTitleBadge() {
  const colTop = gardenIsScrollContainer ? gardenColEl.getBoundingClientRect().top : 0;
  const titleBottom = gardenTitleEl.getBoundingClientRect().bottom;
  gardenNameBadge.classList.toggle('is-visible', titleBottom < colTop + gardenTitleEl.offsetHeight);
}
gardenNameBadge.addEventListener('click', () => gardenScrollEl.scrollTo({ top: 0, behavior: 'smooth' }));
gardenScrollEl.addEventListener('scroll', updateGardenTitleBadge, { passive: true });
window.visualViewport?.addEventListener('resize', updateGardenTitleBadge);
updateGardenTitleBadge();

const SECTION_LINK_TYPES = { foto: 'fotos', herbar: 'herbar', pflanzenlabel: 'pflanzenlabel', notiz: 'notiz' };
Object.entries(SECTION_LINK_TYPES).forEach(([key, slug]) => {
  const el = document.getElementById(`section-link-${key}`);
  if (el) el.href = `/beobachtungen/${slug}?garden=${garden.path ?? garden.id}`;
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

// Collect all relevant slugs: garden list + ALL version placements + garden obs
const relevantSlugs = new Set(garden.plants ?? []);
for (const ver of (planStore?.versions ?? [])) {
  for (const p of (ver.placements ?? [])) relevantSlugs.add(p.slug);
}

const gardenObs = allObservations.filter(o => o.garden === garden.id);
for (const o of gardenObs) {
  for (const slug of (o.slugs ?? [])) relevantSlugs.add(slug);
}

// ── Garden cover image(s) — highlighted obs with a photo ──────────────────────
const coverObs = gardenObs.filter(o => o.highlighted && o.filename);
if (coverObs.length) {
  const { coverUrl, contrastColor } = await import('./utils.js');
  const img = document.getElementById('garden-cover-img');
  const pick = coverObs[Math.floor(Math.random() * coverObs.length)];
  const coverColor = pick.slugs?.map(s => plantBySlug.get(s)?.color).find(Boolean) ?? null;
  if (coverColor) document.getElementById('garden-cover').style.background = coverColor;
  img.src = coverUrl(pick.filename);
  img.hidden = false;
  if (pick.slugs?.length) {
    const container = document.getElementById('garden-cover-plants');
    container.innerHTML = pick.slugs.map(s =>
      `<div class="obs-modal-plant-link botanical-name" data-slug="${s}">${plantBySlug.get(s)?.name ?? s}</div>`
    ).join('');
    container.querySelectorAll('[data-slug]').forEach(el => {
      const plant = plantBySlug.get(el.dataset.slug);
      if (plant?.color) {
        el.style.background = plant.color;
        el.style.color = contrastColor(plant.color);
      }
      el.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('plant:open', { detail: { slug: el.dataset.slug } }));
      });
    });
  }
  if (pick.date) {
    document.getElementById('garden-cover-date').textContent =
      new Date(pick.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  document.getElementById('garden-cover-meta').hidden = false;
}

const gardenPlants = [...relevantSlugs]
  .map(slug => plantBySlug.get(slug))
  .filter(Boolean);

const gardenMap = new Map(gardens.map(g => [g.id, g.name]));
const plantMap  = new Map(allPlants.map(p => [p.slug, p.name]));
const colorMap  = new Map(allPlants.filter(p => p.color).map(p => [p.slug, p.color]));
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

// ── Version switcher — declared early so owner callback can safely reference them
const versionBar = document.getElementById('bed-version-bar');
const versionSel = document.getElementById('version-select');
const publicVersions = planStore?.versions?.filter(v => !v.name?.toLowerCase().startsWith('backup_')) ?? [];
if (publicVersions.length > 1) {
  renderVersionSelect(publicVersions);
  versionBar.hidden = false;
}
versionSel.addEventListener('change', () => {
  getStore().currentId = versionSel.value;
  rerenderBedPlan();
  refreshPlantListForVersion();
});

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

function renderVersionSelect(versions) {
  const store = getStore();
  const list = versions ?? store.versions;
  const sel = document.getElementById('version-select');
  sel.innerHTML = list.map(v =>
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
  const isOwner = garden.created_by === session.user.id;
  if (!isOwner) return;

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

  // Version name editing
  const versionNameInput = document.getElementById('version-name-input');
  function syncVersionNameInput() {
    versionNameInput.value = getActiveVersion()?.name ?? '';
  }
  versionNameInput.addEventListener('blur', () => {
    const name = versionNameInput.value.trim();
    if (!name) return;
    const ver = getActiveVersion();
    if (ver) { ver.name = name; savePlan(); renderVersionSelect(); refreshPlantListForVersion(); }
  });
  versionNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') versionNameInput.blur();
  });

  // Version management (owner: persist selection + copy/config)
  versionSel.addEventListener('change', () => { syncVersionNameInput(); savePlan(); refreshPlantListForVersion(); });

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
    versionBar.hidden = false;
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
    versionBar.hidden = !editMode && getStore().versions.length <= 1;
    document.getElementById('bed-actions').hidden = !editMode;
    if (editMode) {
      renderVersionSelect();
      syncVersionNameInput();
      versionNameInput.hidden = false;
    } else {
      versionNameInput.hidden = true;
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


function updateSectionCounts(obs) {
  const counts = { foto: 0, herbarbeleg: 0, pflanzenlabel: 0, notiz: 0 };
  obs.forEach(o => { if (o.type in counts) counts[o.type]++; });
  const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n || ''; };
  set('obs-type-count-foto', counts.foto);
  set('obs-type-count-herbar', counts.herbarbeleg);
  set('obs-type-count-pflanzenlabel', counts.pflanzenlabel);
  set('obs-type-count-notiz', counts.notiz);
}

const obsSlugSet = new Set(allObservations.flatMap(o => o.slugs ?? []));

function updatePlantCount(n) {
  document.getElementById('plant-count').textContent = n ?? gardenPlants.filter(p => obsSlugSet.has(p.slug)).length;
}

document.addEventListener('plant:filter', e => {
  updatePlantCount(e.detail.slugs.size);
  const badge = document.getElementById('plant-count-sticky');
  if (badge) badge.textContent = `${e.detail.slugs.size} Pflanzen`;
});

const { data: { session } } = await supabase.auth.getSession();
setCurrentUser(session?.user?.id ?? null);

const gardenFotos = [];
initLazyObsCarousel('obs-carousel',          { gardenMap, plantMap, colorMap, sharedList: gardenFotos, garden: garden.id, type: 'foto' });
initLazyObsCarousel('herbar-carousel',       { gardenMap, plantMap, colorMap, sharedList: [],           garden: garden.id, type: 'herbarbeleg', sectionId: 'herbar-section' });
initLazyObsCarousel('pflanzenlabel-carousel',{ gardenMap, plantMap, colorMap, sharedList: [],           garden: garden.id, type: 'pflanzenlabel', sectionId: 'pflanzenlabel-section' });
const gardenObsLabelled = gardenObs.map(o => ({ ...o, place: garden.name }));
renderNotizCarousel(gardenObsLabelled, gardenMap, plantMap);
updateSectionCounts(gardenObs);
let bedSlugs = null;

function refreshPlantListForVersion() {
  const active = getActivePlacements();
  bedSlugs = active.length ? new Set(active.map(p => p.slug)) : null;
  renderPlantList(gardenPlants, { bedSlugs });
  const store = getStore();
  const ver = getActiveVersion();
  const el = document.getElementById('bed-filter-text');
  if (el) el.textContent = publicVersions.length > 1 ? `im Beet ${ver.name}` : 'im Beet';
}

refreshPlantListForVersion();
rerenderBedPlan();


initPlantModal({ gardens, observations: allObservations, plants: allPlants, gardenId: garden.id });
initObsModal({ gardens, plants: allPlants, showAllHref: `/beobachtungen/fotos?garden=${garden.path ?? garden.id}` });
initObsForm({ gardens, plants: allPlants, gardenId: garden.id, observations: allObservations });

['herbar', 'pflanzenlabel', 'notiz'].forEach(type => {
  document.getElementById(`quick-${type}-btn`)?.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('obs:new', { detail: { type: type === 'herbar' ? 'herbarbeleg' : type } }));
  });
});
initAddPlant({
  onAdded(plant) {
    allPlants.push(plant);
    gardenPlants.push(plant);
    addPlantToObsForm(plant);
    renderPlantList(gardenPlants, { bedSlugs });
  },
});

document.addEventListener('obs:saved', e => {
  allObservations.push(e.detail);
  (e.detail.slugs ?? []).forEach(s => obsSlugSet.add(s));
  const gardenObs = allObservations.filter(o => o.garden === garden.id);
  updateSectionCounts(gardenObs);
  if (e.detail.type === 'notiz') {
    renderNotizCarousel(gardenObs, gardenMap, plantMap);
    document.getElementById('notiz-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (e.detail.type === 'foto') {
    prependObsToCarousel({ ...e.detail, place: garden.name }, gardenMap, plantMap);
    const carousel = document.getElementById('obs-carousel');
    if (carousel) carousel.scrollLeft = 0;
  }
  renderPlantList(gardenPlants, { bedSlugs });
});

document.addEventListener('obs:updated', e => {
  const idx = allObservations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) allObservations[idx] = { ...allObservations[idx], ...e.detail };
  (e.detail.slugs ?? []).forEach(s => obsSlugSet.add(s));
  const merged = idx !== -1 ? allObservations[idx] : e.detail;
  updateObsInCarousel({ ...merged, place: merged.place || garden.name }, gardenMap, plantMap);
  renderPlantList(gardenPlants, { bedSlugs });
});

document.addEventListener('obs:deleted', e => {
  const idx = allObservations.findIndex(o => o.id === e.detail.id);
  if (idx !== -1) allObservations.splice(idx, 1);
  obsSlugSet.clear();
  allObservations.forEach(o => (o.slugs ?? []).forEach(s => obsSlugSet.add(s)));
  removeObsFromCarousel(e.detail.id);
  const gardenObs = allObservations.filter(o => o.garden === garden.id);
  updateSectionCounts(gardenObs);
  if (e.detail.type === 'notiz') renderNotizCarousel(gardenObs, gardenMap, plantMap);
  renderPlantList(gardenPlants, { bedSlugs });
});

document.addEventListener('plant:updated', e => {
  const idx = allPlants.findIndex(p => p.slug === e.detail.slug);
  if (idx !== -1) { allPlants[idx] = { ...allPlants[idx], ...e.detail }; renderPlantList(gardenPlants, { bedSlugs }); }
});


// Plant count badge: show beside BG+garden name when filter header is stuck
(function () {
  const plantsSection = document.getElementById('plants-section');
  const plantHeader = document.querySelector('.plant-sticky-header');
  const badge = document.getElementById('plant-count-sticky');
  if (!plantsSection || !plantHeader || !badge) return;

  const plantsCol = document.querySelector('.garden-col--plants');
  const isScrollContainer = plantsCol && getComputedStyle(plantsCol).overflowY === 'auto';
  const root = isScrollContainer ? plantsCol : null;

  const sentinel = document.createElement('div');
  plantsSection.insertBefore(sentinel, plantHeader);

  const isMobile = () => window.matchMedia('(max-width: 899px)').matches;

  new IntersectionObserver(([e]) => {
    const stuck = !e.isIntersecting && e.boundingClientRect.top < 0;
    badge.classList.toggle('is-visible', stuck);
    plantHeader.classList.toggle('is-stuck', stuck);
    gardenNameBadge.textContent = (stuck && isMobile()) ? gardenNameInitials : garden.name;
  }, { threshold: 0, root }).observe(sentinel);
})();

// Lock panels open on click; release by clicking col 1
const panels   = document.querySelector('.garden-panels');
const gardenCol = document.querySelector('.garden-col--garden');
panels.addEventListener('click', () => panels.classList.add('is-expanded'));
gardenCol.addEventListener('click', () => panels.classList.remove('is-expanded'));
