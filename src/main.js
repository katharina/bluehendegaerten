import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Scene ─────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('c');
const wrap   = document.getElementById('canvas-wrap');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xffffff);
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(55, 1, 0.001, 200);
camera.position.set(0, -0.2, 10);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -2.5, -6);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent camera going below ground
controls.update();

// ── Orthographic cameras ───────────────────────────────────────────────────────
// Garden footprint: X ±4.5 m (east-west), Z ±8.25 m (north-south), Y 0 → −4 m
// Isometric target: centre of the garden mass
const ISO_TARGET = new THREE.Vector3(0, -0.8, 0);
const ISO_DIST   = 20;
const D          = ISO_DIST / Math.sqrt(3); // ≈ 11.55 — equal offset on each axis

function makeIsoCam(dx, dz) {
  const cam = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 80);
  cam.position.set(ISO_TARGET.x + dx, ISO_TARGET.y + D, ISO_TARGET.z + dz);
  cam.lookAt(ISO_TARGET);
  cam.userData.home = cam.position.clone();
  return cam;
}

const isoCams = {
  'iso-se': makeIsoCam( D,  D),
  'iso-sw': makeIsoCam(-D,  D),
  'iso-ne': makeIsoCam( D, -D),
  'iso-nw': makeIsoCam(-D, -D),
};

let activeCamera = camera;

// Dedicated controls for iso views — created with an ortho camera so zoom works correctly
const isoControls = new OrbitControls(isoCams['iso-se'], canvas);
isoControls.enableRotate = false;
isoControls.enableDamping = true;
isoControls.dampingFactor = 0.08;
isoControls.target.copy(ISO_TARGET);
isoControls.enabled = false;
isoControls.update();

// Top-down orthographic camera for placement editing
const topCam = new THREE.OrthographicCamera(-12, 12, 12, -12, 0.1, 100);
topCam.position.set(0, 40, 0);
topCam.up.set(0, 0, -1); // north (-Z) points up on screen
topCam.lookAt(0, 0, 0);
topCam.userData.home = topCam.position.clone();

const topControls = new OrbitControls(topCam, canvas);
topControls.enableRotate = false;
topControls.enableDamping = true;
topControls.dampingFactor = 0.08;
topControls.target.set(0, 0, 0);
topControls.enabled = false;
topControls.update();

const ORBIT_TARGET = new THREE.Vector3(0, -2.5, -6);

function setView(name) {
  const wasTop = activeCamera === topCam;
  const isIso  = name.startsWith('iso-');
  const isTop  = name === 'top';
  activeCamera = isIso ? isoCams[name] : (isTop ? topCam : camera);
  controls.enabled    = !isIso && !isTop;
  isoControls.enabled =  isIso;
  topControls.enabled =  isTop;
  if (isIso) {
    isoControls.object = activeCamera;
    activeCamera.position.copy(activeCamera.userData.home);
    activeCamera.zoom = 1;
    activeCamera.updateProjectionMatrix();
    isoControls.target.copy(ISO_TARGET);
    isoControls.update();
  }
  if (isTop) {
    topCam.position.copy(topCam.userData.home);
    topCam.zoom = 1;
    topCam.updateProjectionMatrix();
    topControls.object = topCam;
    topControls.target.set(0, 0, 0);
    topControls.update();
  }
  if (!wasTop && isTop) {
    if (activeGroup) activeGroup.visible = false;
    buildTopViewCircles();
  }
  if (wasTop && !isTop) {
    clearTopViewCircles();
    if (activeGroup) activeGroup.visible = true;
  }
  document.querySelectorAll('.view-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.view === name));
}

async function exportSVG() {
  const btn = document.getElementById('export-btn');
  btn.textContent = 'Exporting…';
  btn.disabled = true;

  try {
    const { SVGRenderer } = await import('three/examples/jsm/renderers/SVGRenderer.js');
    const exportRenderer = new SVGRenderer();
    const w = wrap.clientWidth, h = wrap.clientHeight;
    exportRenderer.setSize(w, h);
    exportRenderer.render(scene, activeCamera);

    const svg = exportRenderer.domElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
    bg.setAttribute('width', String(w)); bg.setAttribute('height', String(h));
    bg.setAttribute('fill', '#ffffff');
    svg.insertBefore(bg, svg.firstChild);

    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `garden_${document.querySelector('.view-btn.active')?.dataset.view ?? 'view'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } finally {
    btn.textContent = 'Export SVG';
    btn.disabled = false;
  }
}

document.querySelectorAll('.view-btn').forEach(btn =>
  btn.addEventListener('click', () => { if (!_editMode) setView(btn.dataset.view); }));
setView('iso-se');
document.getElementById('export-btn')?.addEventListener('click', exportSVG);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xfff6e8, 0.8);
sun.position.set(3, 5, 4);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe8f0ff, 0.3);
fill.position.set(-3, 2, -2);
scene.add(fill);

// ── Version management ────────────────────────────────────────────────────────

const STORAGE_KEY = 'bluehendegaerten';

function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null; } catch { return null; }
}

let store = loadStore() ?? {
  versions: [{ id: 'default', name: 'Garten 1', placements: [] }],
  currentId: 'default',
};

function saveStore() {
  store._savedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  fetch('/api/plans/betonbeete', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: JSON.stringify(store) }),
  }).catch(() => {});
}

function currentVersion() {
  return store.versions.find(v => v.id === store.currentId) ?? store.versions[0];
}

function renderVersionBar() {
  const sel = document.getElementById('version-select');
  sel.innerHTML = '';
  for (const v of store.versions) {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = v.name;
    opt.selected = v.id === store.currentId;
    sel.appendChild(opt);
  }
  document.getElementById('version-delete').disabled = store.versions.length <= 1;
}

function rebuildForVersion() {
  for (const k of Object.keys(gardens))      delete gardens[k];
  for (const k of Object.keys(swayByMonth))  delete swayByMonth[k];
}

function switchVersion(id) {
  store.currentId = id;
  saveStore();
  renderVersionBar();
  rebuildForVersion();
  if (_manifest) {
    showMonth(currentMonth);
    if (_editMode) buildTopViewCircles();
  }
}

function createVersion() {
  const name = prompt('Name for new garden version:', `Garten ${store.versions.length + 1}`);
  if (!name) return;
  const id  = Date.now().toString(36);
  store.versions.push({ id, name, placements: [] });
  store.currentId = id;
  saveStore();
  renderVersionBar();
  rebuildForVersion();
  if (_manifest) {
    showMonth(currentMonth);
    if (_editMode) buildTopViewCircles();
  }
}

function deleteVersion() {
  if (store.versions.length <= 1) return;
  const ver = currentVersion();
  if (!confirm(`„${ver.name}" wirklich löschen?`)) return;
  const idx = store.versions.findIndex(v => v.id === store.currentId);
  store.versions.splice(idx, 1);
  store.currentId = store.versions[Math.max(0, idx - 1)].id;
  saveStore();
  renderVersionBar();
  rebuildForVersion();
  if (_manifest) {
    showMonth(currentMonth);
    if (_editMode) buildTopViewCircles();
  }
}

document.getElementById('version-select').addEventListener('change', e => switchVersion(e.target.value));
document.getElementById('version-new').addEventListener('click', createVersion);
document.getElementById('version-delete').addEventListener('click', deleteVersion);
renderVersionBar();

// ── Plant panel ───────────────────────────────────────────────────────────────

let _uniquePlants  = [];
let _selectedSlug  = null;
let _prevView      = 'iso-se';
let _editMode      = false;
let _plantFilter   = '';

// ── Grid placement helpers ────────────────────────────────────────────────────
const GRID_STEP = 0.4;

function snapToRef(v, ref) {
  return ref + (Math.floor((v - ref) / GRID_STEP) + 0.5) * GRID_STEP;
}
// beds is defined later; these helpers are called only at interaction time
function snapGridX(v) { return snapToRef(v, -BED_L / 2); }
function snapGridZ(v) {
  const bed = beds?.find(b => v >= b.z - b.w / 2 - GRID_STEP && v <= b.z + b.w / 2 + GRID_STEP);
  return snapToRef(v, bed ? bed.z - bed.w / 2 : 0);
}

function seededRng(seed) {
  let s = seed.split('').reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 0);
  return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 0) / 0x100000000; };
}

function cellPositions(p, density) {
  const rng = seededRng(p.id);
  const spread = GRID_STEP * (density <= 1 ? 0.55 : 0.82);
  return Array.from({ length: Math.max(1, density) }, () => ({
    x: p.x + (rng() - 0.5) * spread,
    z: p.z + (rng() - 0.5) * spread,
  }));
}

let _gridOverlay  = null;  // LineSegments grid
let _gridHover    = null;  // single hover cell Mesh
let _gridDragPrev = null;  // rectangle preview Mesh
let _gridDrag     = null;  // { x0, z0, x1, z1, addMode } while dragging

function buildGridOverlay() {
  if (_gridOverlay) { scene.remove(_gridOverlay); _gridOverlay = null; }
  const pts = [];
  const Y   = 0.018;
  for (const bed of beds) {
    const x0 = -BED_L / 2, x1 = BED_L / 2;
    const z0 = bed.z - bed.w / 2, z1 = bed.z + bed.w / 2;
    for (let z = z0; z <= z1 + 1e-6; z = Math.round((z + GRID_STEP) * 1e6) / 1e6) {
      pts.push(new THREE.Vector3(x0, Y, z), new THREE.Vector3(x1, Y, z));
    }
    for (let x = x0; x <= x1 + 1e-6; x = Math.round((x + GRID_STEP) * 1e6) / 1e6) {
      pts.push(new THREE.Vector3(x, Y, z0), new THREE.Vector3(x, Y, z1));
    }
  }
  _gridOverlay = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 }),
  );
  scene.add(_gridOverlay);
}

function removeGridOverlay() {
  if (_gridOverlay)  { scene.remove(_gridOverlay);  _gridOverlay  = null; }
  if (_gridHover)    { scene.remove(_gridHover);     _gridHover    = null; }
  if (_gridDragPrev) { scene.remove(_gridDragPrev);  _gridDragPrev = null; }
  _gridDrag = null;
}

function setGridHover(x, z, color) {
  if (_gridHover) { scene.remove(_gridHover); _gridHover = null; }
  if (x === null) return;
  const s = GRID_STEP * 0.88;
  const geo = new THREE.PlaneGeometry(s, s);
  geo.rotateX(-Math.PI / 2);
  _gridHover = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
  _gridHover.position.set(x, 0.019, z);
  scene.add(_gridHover);
}

function setGridDragPreview(x0, z0, x1, z1, addMode, color) {
  if (_gridDragPrev) { scene.remove(_gridDragPrev); _gridDragPrev = null; }
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const za = Math.min(z0, z1), zb = Math.max(z0, z1);
  const w = xb - xa + GRID_STEP * 0.88;
  const d = zb - za + GRID_STEP * 0.88;
  const geo = new THREE.PlaneGeometry(w, d);
  geo.rotateX(-Math.PI / 2);
  _gridDragPrev = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: addMode ? color : 0xff2222, transparent: true, opacity: 0.35 }),
  );
  _gridDragPrev.position.set((xa + xb) / 2, 0.019, (za + zb) / 2);
  scene.add(_gridDragPrev);
}

function updateGridMode() {
  if (_editMode && _selectedSlug) {
    if (!_gridOverlay) buildGridOverlay();
  } else {
    removeGridOverlay();
  }
  requestRender();
}

function selectPlant(slug) {
  _selectedSlug = _selectedSlug === slug ? null : slug;
  canvas.classList.toggle('selecting', !!_selectedSlug);
  renderPlantPanel();
  renderInfoPanel(_selectedSlug);
  updateGridMode();
}

function renderPlantPanel() {
  const list = document.getElementById('plant-list');
  if (!list || !_uniquePlants.length) return;
  const q = _plantFilter.toLowerCase();
  const visible = q
    ? _uniquePlants.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.name_de ?? '').toLowerCase().includes(q))
    : _uniquePlants;
  list.innerHTML = '';
  for (const plant of visible) {
    const row = document.createElement('div');
    row.className = 'plant-row' + (_selectedSlug === plant.slug ? ' selected' : '');
    row.innerHTML = `
      <div class="plant-name">${plant.name_de ?? plant.name}</div>
      ${plant.name_de ? `<div class="plant-name-la">${plant.name}</div>` : ''}
    `;
    row.addEventListener('click', () => selectPlant(plant.slug));
    list.appendChild(row);
  }
}

document.getElementById('plant-search').addEventListener('input', e => {
  _plantFilter = e.target.value;
  renderPlantPanel();
});

const _STAGE_LABELS = { bloom:'Blüte', foliage:'Laub', seed:'Samen', sprout:'Keim', dried:'Getrocknet' };
const _MONTH_KEYS   = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const _MONTH_SHORT  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthsToRange(months) {
  const idx = months.map(m => _MONTH_KEYS.indexOf(m)).filter(i => i >= 0).sort((a, b) => a - b);
  if (!idx.length) return '—';
  const contig = idx.every((v, i, a) => i === 0 || v === a[i - 1] + 1);
  if (contig) return idx.length === 1
    ? _MONTH_SHORT[idx[0]]
    : `${_MONTH_SHORT[idx[0]]} – ${_MONTH_SHORT[idx[idx.length - 1]]}`;
  return idx.map(i => _MONTH_SHORT[i]).join(' ');
}

function renderInfoPanel(slug) {
  const panel = document.getElementById('info-panel');
  if (!panel) return;
  if (!slug || !_editMode || !_manifest) { panel.classList.remove('visible'); return; }
  const plant = _uniquePlants.find(u => u.slug === slug);
  if (!plant) { panel.classList.remove('visible'); return; }

  const entries = _manifest.filter(e => e.slug === slug);
  const hCm = Math.round((plant.worldH ?? 1) * 100);
  const wCm = Math.round(plant.worldW * 100);
  const ver = currentVersion();
  const density = ver.densities?.[slug] ?? 1;

  const stagesHtml = entries.map(e => `
    <div class="info-stage-row">
      <div class="stage-label">${_STAGE_LABELS[e.stage] ?? e.stage}</div>
      <div class="stage-months-text">${monthsToRange(e.months)}</div>
    </div>`).join('');

  const imgStage = entries.find(e => e.stage === 'bloom') ?? entries[0];
  const imgSrc   = imgStage
    ? `${import.meta.env.BASE_URL}plants/${plant.slug}_${imgStage.stage}.png`
    : null;

  document.getElementById('info-content').innerHTML = `
    ${imgSrc ? `<img class="info-img" src="${imgSrc}" alt="${plant.name}">` : ''}
    <div class="info-header">
      <span class="info-dot" style="background:${plant.color}"></span>
      <div>
        ${plant.name_de ? `<div class="info-name-de">${plant.name_de}</div>` : ''}
        <div class="info-plant-name">${plant.name}</div>
      </div>
    </div>
    <div class="info-dims">${hCm} × ${wCm} cm</div>
    <div class="info-density-row">
      <span class="stage-label">Dichte</span>
      <div class="density-ctrl">
        <button class="density-btn" data-slug="${slug}" data-delta="-1">−</button>
        <span class="density-val" id="density-val-${slug}">${density}</span>
        <button class="density-btn" data-slug="${slug}" data-delta="1">+</button>
      </div>
    </div>
    ${stagesHtml}
  `;
  panel.classList.add('visible');

  panel.querySelectorAll('.density-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = currentVersion();
      if (!v.densities) v.densities = {};
      const cur = v.densities[btn.dataset.slug] ?? 1;
      v.densities[btn.dataset.slug] = Math.max(1, Math.min(16, cur + Number(btn.dataset.delta)));
      saveStore();
      document.getElementById(`density-val-${btn.dataset.slug}`).textContent = v.densities[btn.dataset.slug];
      rebuildForVersion();
      showMonth(currentMonth);
      buildTopViewCircles();
    });
  });
}

function enterEditMode() {
  if (!_editMode) {
    _prevView = document.querySelector('.view-btn.active')?.dataset.view ?? 'iso-se';
    _plantFilter = '';
    const searchEl = document.getElementById('plant-search');
    if (searchEl) searchEl.value = '';
  }
  _editMode = true;
  setView('top');
  document.getElementById('plant-panel').classList.add('open');
  document.getElementById('btn-edit').classList.add('active');
  document.getElementById('btn-view').classList.remove('active');
  updateGridMode();
}

function enterViewMode() {
  if (_selectedSlug) {
    _selectedSlug = null;
    canvas.classList.remove('selecting');
    renderPlantPanel();
  }
  _editMode = false;
  removeGridOverlay();
  renderInfoPanel(null);
  setView(_prevView);
  document.getElementById('plant-panel').classList.remove('open');
  document.getElementById('btn-edit').classList.remove('active');
  document.getElementById('btn-view').classList.add('active');
  saveStore();
  const btn = document.getElementById('btn-view');
  const orig = btn.textContent;
  btn.textContent = 'Gespeichert';
  setTimeout(() => { btn.textContent = orig; }, 1400);
}

document.getElementById('btn-edit').addEventListener('click', enterEditMode);
document.getElementById('btn-view').addEventListener('click', enterViewMode);


// ── Garden bed layout ─────────────────────────────────────────────────────────
// 9 beds from north (−Z) to south (+Z), each 9 m east-west.
// Width alternates 1.5 / 3 m; 50 cm paths between beds; elevation steps down 20 cm per bed.

const BED_L  = 9;
const BED_GAP = 0.5;
const WALL_H = 0.10;
const WALL_T = 0.05;
const bedWidths = [1.5, 1.5, 1.5, 1.5, 3.0, 1.5, 1.5, 1.5, 3.0];

const beds = (() => {
  const total = bedWidths.reduce((a, b) => a + b, 0) + BED_GAP * (bedWidths.length - 1);
  let cursor = -total / 2;
  return bedWidths.map((w, i) => {
    const z = cursor + w / 2;
    cursor += w + BED_GAP;
    return { w, z, y: -i * 0.2 };
  });
})();

function makeSoilTexture() {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;

  // Seamless: wrap grid coords at period S so noise tiles perfectly
  function hash(xi, yi) {
    const x = ((xi % S) + S) % S;
    const y = ((yi % S) + S) % S;
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }
  function ss(t) { return t * t * (3 - 2 * t); }
  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = ss(x - ix), fy = ss(y - iy);
    return (hash(ix,iy)*(1-fx) + hash(ix+1,iy)*fx) * (1-fy)
         + (hash(ix,iy+1)*(1-fx) + hash(ix+1,iy+1)*fx) * fy;
  }
  // Scale octaves so each wraps evenly within S texels
  function fbm(px, py) {
    // octave frequencies in texel-space: 1, 2, 4, 8 → all divide S evenly
    return vnoise(px,py)*0.50 + vnoise(px*2,py*2)*0.25
         + vnoise(px*4,py*4)*0.15 + vnoise(px*8,py*8)*0.10;
  }

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm(x / S * 16, y / S * 16); // 16 base cells across S
      const v = (n - 0.5) * 0.45;
      const i = (y * S + x) * 4;
      d[i]   = Math.max(0, Math.min(255, Math.round(0x12 * (1 + v))));
      d[i+1] = Math.max(0, Math.min(255, Math.round(0x0b * (1 + v * 0.8))));
      d[i+2] = Math.max(0, Math.min(255, Math.round(0x04 * (1 + v * 0.5))));
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const _soilTex = makeSoilTexture();

function makeBlobShadowTex() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
  grad.addColorStop(0,   'rgba(0,0,0,0.50)');
  grad.addColorStop(0.4, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(canvas);
}
const _blobShadowTex = makeBlobShadowTex();

function addBlobShadows(g, positions, worldW, clips = null) {
  if (!positions.length) return;
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    map: _blobShadowTex,
    transparent: true,
    depthWrite: false,
  });
  if (clips) mat.clippingPlanes = clips;
  const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const r = worldW * 1.1;
  positions.forEach((p, i) => {
    dummy.position.set(p.x, p.y + 0.003, p.z);
    dummy.rotation.x = -Math.PI / 2;
    dummy.scale.set(r * p.scale, r * p.scale, 1);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  g.add(mesh);
}

const bedMat    = null; // per-bed materials created in the loop below
const shadowMat = new THREE.ShadowMaterial({ opacity: 0.18, transparent: true });
const borderMat = new THREE.LineBasicMaterial({ color: 0x666666 });
const wallMat   = new THREE.MeshLambertMaterial({ color: 0xc8bfb4 });

for (const bed of beds) {
  const geo = new THREE.PlaneGeometry(BED_L, bed.w);

  const border = new THREE.LineSegments(new THREE.EdgesGeometry(geo), borderMat);
  border.rotation.x = -Math.PI / 2;
  border.position.set(0, bed.y + 0.002, bed.z);
  scene.add(border);

}

// ── Billboard pipeline ────────────────────────────────────────────────────────

// Seeded RNG
function rng(seed) {
  let s = seed | 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

const FRAG = `
#include <clipping_planes_pars_fragment>
uniform sampler2D map;
varying vec2 vUv;
void main() {
  #include <clipping_planes_fragment>
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb, 1.0);
}`;

// Vertical: cylindrical billboard, pivot at base, always faces camera around Y
const VERT_VERTICAL = `
#include <clipping_planes_pars_vertex>
uniform float time;
attribute vec3 iPos;
attribute float iScale;
varying vec2 vUv;
void main() {
  vUv    = uv;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  right.y    = 0.0;
  right      = normalize(right);
  // gentle sway: grows with height, unique phase per plant
  float phase = iPos.x * 1.7 + iPos.z * 2.3;
  float sway  = position.y * iScale * sin(time * 1.2 + phase) * 0.04;
  vec3 world = iPos
    + right               * (position.x * iScale + sway)
    + vec3(0.0, 1.0, 0.0) *  position.y * iScale;
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
  // per-instance depth nudge — prevents Z-fighting between coplanar billboards
  float h = fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position.z -= h * 0.0002 * gl_Position.w;
}`;

// Horizontal: lies near-flat on ground with a gentle tilt, random Y rotation per instance
const VERT_HORIZONTAL = `
#include <clipping_planes_pars_vertex>
uniform float tilt;
attribute vec3 iPos;
attribute float iScale;
attribute float iRotY;
attribute vec3 iColor;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv    = uv;
  vColor = iColor;
  float c  = cos(iRotY);
  float s  = sin(iRotY);
  float ct = cos(tilt);
  float st = sin(tilt);
  // position.x stays in the ground plane; position.y is tilted upward by tilt angle
  vec3 world = vec3(
    iPos.x + (position.x * c - position.y * ct * s) * iScale,
    iPos.y  +  position.y * st * iScale,
    iPos.z  + (position.x * s + position.y * ct * c) * iScale
  );
  vec4 mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;

const swayByMonth = {};

// orient: 'vertical' (default) or 'horizontal'
// worldW / worldH: real-world metres the plane spans
// tilt: for horizontal, radians from flat (0 = pancake, PI/2 = upright) — default 0.35 (~20°)
function makeBillboardMesh(texture, positions, { orient = 'vertical', worldW = 0.8, worldH = 1.0, tilt = 0.35 } = {}) {
  const count = positions.length;
  const horiz = orient === 'horizontal';
  const geo   = new THREE.PlaneGeometry(worldW, worldH);
  if (!horiz) geo.translate(0, worldH / 2 - 0.06, 0); // vertical: pivot at base, -0.06 corrects for 24px bottom canvas padding

  const posArr   = new Float32Array(count * 3);
  const scaleArr = new Float32Array(count);
  const colorArr = new Float32Array(count * 3);
  const rotArr   = horiz ? new Float32Array(count) : null;

  const rand = rng(7331);
  positions.forEach((p, i) => {
    posArr[i*3]   = p.x;
    posArr[i*3+1] = p.y + (horiz ? 0.01 + rand() * 0.02 : 0); // tiny Y jitter kills depth fighting
    posArr[i*3+2] = p.z;
    scaleArr[i]   = p.scale;
    const b = 0.88 + rand() * 0.2;
    const h = (rand() - 0.5) * 0.12;
    colorArr[i*3]   = Math.min(1, b + h);
    colorArr[i*3+1] = Math.min(1, b);
    colorArr[i*3+2] = Math.min(1, b - h);
    if (rotArr) rotArr[i] = rand() * Math.PI * 2;
  });

  geo.setAttribute('iPos',   new THREE.InstancedBufferAttribute(posArr,   3));
  geo.setAttribute('iScale', new THREE.InstancedBufferAttribute(scaleArr, 1));
  geo.setAttribute('iColor', new THREE.InstancedBufferAttribute(colorArr, 3));
  if (rotArr) geo.setAttribute('iRotY', new THREE.InstancedBufferAttribute(rotArr, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms:       { map: { value: texture }, tilt: { value: tilt }, time: { value: 0 } },
    vertexShader:   horiz ? VERT_HORIZONTAL : VERT_VERTICAL,
    fragmentShader: FRAG,
    depthWrite:     true,
    polygonOffset:  horiz,
    polygonOffsetFactor: horiz ? 1 : 0,
    polygonOffsetUnits:  horiz ? 4 : 0,
    side:           THREE.DoubleSide,
  });

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  return mesh;
}

const FIXED_CANVAS_WORLD_H = 2.5; // MAX_PLANT_CM/100 — matches process-existing.js fixed canvas scale

const DENSITY_MULT = 3;
const CLUMP_RADIUS = 0.35;

// When true, only entries with an explicit beds[] in the manifest are shown.
const EXPLICIT_BEDS_MODE = false;

// Generate world-space placement for a plant across selected beds (null = all).
function scatterBeds(seed, density = 2, bedIndices = null) {
  const rand       = rng(seed);
  const margin     = 0.05;
  const activeBeds = bedIndices ? beds.filter((_, i) => bedIndices.includes(i)) : beds;
  return activeBeds.flatMap(bed => {
    const xMin = -(BED_L / 2 - margin), xMax = BED_L / 2 - margin;
    const zMin = bed.z - bed.w / 2 + margin, zMax = bed.z + bed.w / 2 - margin;
    const bedW = xMax - xMin, bedD = zMax - zMin;

    // pass 1 — jittered grid, one plant per cell, no holes
    const anchorCount = Math.max(4, Math.round(bedW * bedD * density));
    const spacing     = Math.sqrt(bedW * bedD / anchorCount);
    const cols        = Math.max(1, Math.round(bedW / spacing));
    const rows        = Math.max(1, Math.round(bedD / spacing));
    const placed      = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = Math.max(xMin, Math.min(xMax,
          xMin + (c + 0.5) * (bedW / cols) + (rand() - 0.5) * spacing * 0.5));
        const z = Math.max(zMin, Math.min(zMax,
          zMin + (r + 0.5) * (bedD / rows) + (rand() - 0.5) * spacing * 0.5));
        placed.push({ x, y: bed.y, z, scale: 0.7 + rand() * 0.6 });
      }
    }

    // pass 2 — clumped extras for density
    const total = Math.round(bedW * bedD * density * DENSITY_MULT);
    for (let i = placed.length; i < total; i++) {
      const anchor = placed[Math.floor(rand() * placed.length)];
      const x = Math.max(xMin, Math.min(xMax, anchor.x + (rand() - 0.5) * 2 * CLUMP_RADIUS));
      const z = Math.max(zMin, Math.min(zMax, anchor.z + (rand() - 0.5) * 2 * CLUMP_RADIUS));
      placed.push({ x, y: bed.y, z, scale: 0.7 + rand() * 0.6 });
    }
    return placed;
  });
}

// ── Load + display ────────────────────────────────────────────────────────────

let activeGroup  = null;
let currentMonth = 'june';
const gardens    = {};
const MONTHS     = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// module-level so showMonth can build lazily
let _manifest = null, _textures = null;

function yAtPosition(x, z) {
  const bed = beds.find(b =>
    z >= b.z - b.w / 2 && z <= b.z + b.w / 2 && Math.abs(x) <= BED_L / 2);
  return bed ? bed.y : 0;
}

function scaleForPos(x, z) {
  const v = ((Math.sin(x * 127.1 + z * 311.7) * 43758.5453) % 1 + 1) % 1;
  return 1.0 + v * 0.25;
}

// Clip planes that confine billboard geometry to the inner soil area of a bed.
// Plants near walls protrude geometrically (cylindrical billboard extends in camera-right),
// so we clip at the soil boundary — the wall covers the rest.
function bedClipPlanes(bed) {
  return [
    new THREE.Plane(new THREE.Vector3(0, 0, -1),  bed.z + bed.w / 2),     // south
    new THREE.Plane(new THREE.Vector3(0, 0,  1), -(bed.z - bed.w / 2)),   // north
    new THREE.Plane(new THREE.Vector3(-1, 0, 0),  BED_L / 2),             // east
    new THREE.Plane(new THREE.Vector3( 1, 0, 0),  BED_L / 2),             // west
  ];
}

function addVariantMeshes(g, mats, tex, allPositions, variants, tkey, textures, opts, clips = null) {
  for (let v = 0; v < variants; v++) {
    const vkey = v === 0 ? tkey : `${tkey}_${v + 1}`;
    const t    = textures[vkey] ?? tex;
    const positions = allPositions.filter((_, i) => i % variants === v);
    if (!positions.length) continue;
    const mesh = makeBillboardMesh(t, positions, opts);
    if (clips) mesh.material.clippingPlanes = clips;
    g.add(mesh);
    mats.push(mesh.material);
  }
}

function buildMonth(key) {
  if (gardens[key]) return;
  const g   = new THREE.Group();
  const mats = [];
  const ver  = currentVersion();

  const placements = ver.placements ?? [];
  const bySlug = {};
  for (const p of placements) (bySlug[p.slug] ??= []).push(p);

  for (const [slug, list] of Object.entries(bySlug)) {
    const entry = _manifest.find(e => e.slug === slug && e.months.includes(key));
    if (!entry) continue;
    const tkey = `${slug}_${entry.stage}`;
    if (!_textures[tkey]) continue;
    const variants  = entry.variants ?? 1;
    const tex0      = _textures[tkey];
    const imgAspect = tex0 ? tex0.image.width / tex0.image.height : entry.worldW / entry.worldH;
    const billboardH = entry.fixedCanvas ? FIXED_CANVAS_WORLD_H : entry.worldH;
    const opts = { orient: 'vertical', worldW: billboardH * imgAspect, worldH: billboardH };
    const density = ver.densities?.[slug] ?? 1;

    for (let bi = 0; bi < beds.length; bi++) {
      const bed = beds[bi];
      const bedList = list.filter(p =>
        p.z >= bed.z - bed.w / 2 && p.z <= bed.z + bed.w / 2 && Math.abs(p.x) <= BED_L / 2);
      if (!bedList.length) continue;
      const allPositions = bedList.flatMap(p =>
        cellPositions(p, density).map(({ x, z }) => ({
          x, z, y: yAtPosition(x, z), scale: scaleForPos(x, z),
        }))
      );
      const clips = bedClipPlanes(bed);
      addVariantMeshes(g, mats, _textures[tkey], allPositions, variants, tkey, _textures, opts, clips);
      addBlobShadows(g, allPositions, entry.worldW, clips);
    }
  }

  gardens[key]     = g;
  swayByMonth[key] = mats;
}

function showMonth(key) {
  currentMonth = key;
  if (activeGroup) scene.remove(activeGroup);
  buildMonth(key);
  activeGroup = gardens[key] ?? null;
  if (activeGroup) {
    scene.add(activeGroup);
    if (activeCamera === topCam) activeGroup.visible = false;
  }
  document.querySelectorAll('.month-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.month === key));
}

async function init() {
  // sync planting plan from server (prefer server if newer)
  try {
    const res = await fetch('/api/plans/betonbeete');
    if (res.ok) {
      const { data } = await res.json();
      if (data) {
        const serverStore = JSON.parse(data);
        if (!store._savedAt || (serverStore._savedAt ?? 0) > store._savedAt) {
          store = serverStore;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
          renderVersionBar();
        }
      }
    }
  } catch {}

  _manifest = await fetch(`${import.meta.env.BASE_URL}plants/manifest.json`).then(r => r.json());
  _manifest = _manifest.filter(entry => entry.slug !== 'paeonia');

  const loader = new THREE.TextureLoader();
  _textures = {};
  await Promise.all(_manifest.map(async entry => {
    const key = `${entry.slug}_${entry.stage}`;
    try {
      const tex = await loader.loadAsync(`${import.meta.env.BASE_URL}plants/${key}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      _textures[key] = tex;
    } catch { }
    for (let v = 2; v <= (entry.variants ?? 1); v++) {
      try {
        const tex = await loader.loadAsync(`${import.meta.env.BASE_URL}plants/${key}_${v}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.NearestFilter;
        tex.magFilter = THREE.NearestFilter;
        _textures[`${key}_${v}`] = tex;
      } catch { }
    }
  }));

  const seen = new Set();
  _uniquePlants = [];
  for (const entry of _manifest) {
    if (!seen.has(entry.slug)) {
      seen.add(entry.slug);
      _uniquePlants.push({
        slug: entry.slug, name: entry.name ?? entry.slug,
        name_de: entry.name_de ?? null,
        color: entry.color ?? '#888888', worldW: entry.worldW, worldH: entry.worldH,
        defaultBeds: entry.beds ?? null, placementType: entry.placementType ?? 'point',
      });
    }
  }
  renderPlantPanel();

  showMonth('june');
}
init();

document.querySelectorAll('.month-btn').forEach(btn =>
  btn.addEventListener('click', () => showMonth(btn.dataset.month)));

// ── Top-view circles ─────────────────────────────────────────────────────────

let _circleGroup = null;

function buildTopViewCircles() {
  if (_circleGroup) { scene.remove(_circleGroup); _circleGroup = null; }
  const ver = currentVersion();
  if (!ver.placements?.length) { _circleGroup = null; return; }

  const cellGeo = new THREE.PlaneGeometry(GRID_STEP * 0.92, GRID_STEP * 0.92);
  cellGeo.rotateX(-Math.PI / 2);
  const dotGeo  = new THREE.CircleGeometry(GRID_STEP * 0.09, 8);
  dotGeo.rotateX(-Math.PI / 2);

  const group = new THREE.Group();
  for (const p of ver.placements) {
    const plant = _uniquePlants.find(u => u.slug === p.slug);
    if (!plant) continue;
    const density = ver.densities?.[plant.slug] ?? 1;
    const y = yAtPosition(p.x, p.z) + 0.012;
    const mat = new THREE.MeshBasicMaterial({ color: plant.color, transparent: true, opacity: 0.4 });
    const fill = new THREE.Mesh(cellGeo, mat);
    fill.position.set(p.x, y, p.z);
    group.add(fill);

    const dotMat = new THREE.MeshBasicMaterial({ color: plant.color, transparent: true, opacity: 0.9 });
    for (const { x, z } of cellPositions(p, density)) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x, y + 0.001, z);
      group.add(dot);
    }
  }
  _circleGroup = group;
  scene.add(group);
}

function clearTopViewCircles() {
  if (_circleGroup) { scene.remove(_circleGroup); _circleGroup = null; }
}

// ── Placement interaction ─────────────────────────────────────────────────────

const _hitPlane  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _raycaster = new THREE.Raycaster();

function groundPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const ndc  = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width)  *  2 - 1,
    ((event.clientY - rect.top)  / rect.height) * -2 + 1,
  );
  _raycaster.setFromCamera(ndc, activeCamera);
  const pt = new THREE.Vector3();
  return _raycaster.ray.intersectPlane(_hitPlane, pt) ? pt : null;
}

function commitPlacements() {
  saveStore(); rebuildForVersion(); showMonth(currentMonth); buildTopViewCircles();
}

function inAnyBed(x, z) {
  return beds.some(b => z >= b.z - b.w / 2 && z <= b.z + b.w / 2 && Math.abs(x) <= BED_L / 2);
}

function hasGridCell(placements, slug, x, z) {
  return placements.some(p => p.slug === slug && Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01);
}

let _dragStart = null;

canvas.addEventListener('mousemove', e => {
  if (!_editMode || !_selectedSlug) return;
  const pt = groundPoint(e);
  if (!pt) { setGridHover(null, null, 0); return; }
  const sx = snapGridX(pt.x), sz = snapGridZ(pt.z);
  const plant = _uniquePlants.find(p => p.slug === _selectedSlug);
  if (!plant) return;

  if (_gridDrag) {
    _gridDrag.x1 = sx; _gridDrag.z1 = sz;
    setGridDragPreview(_gridDrag.x0, _gridDrag.z0, sx, sz, _gridDrag.addMode, parseInt(plant.color.replace('#',''), 16));
    if (_gridHover) { scene.remove(_gridHover); _gridHover = null; }
  } else {
    setGridHover(inAnyBed(sx, sz) ? sx : null, sz, parseInt(plant.color.replace('#',''), 16));
  }
  requestRender();
});

canvas.addEventListener('mouseleave', () => {
  if (_gridHover) { scene.remove(_gridHover); _gridHover = null; requestRender(); }
});

canvas.addEventListener('mousedown', e => {
  _dragStart = { x: e.clientX, y: e.clientY };
  if (e.button !== 0 || !_editMode || !_selectedSlug) return;
  const ver = currentVersion();
  if (!ver.placements) return;
  const pt = groundPoint(e);
  if (!pt) return;
  const sx = snapGridX(pt.x), sz = snapGridZ(pt.z);
  if (!inAnyBed(sx, sz)) return;
  const addMode = !hasGridCell(ver.placements, _selectedSlug, sx, sz);
  _gridDrag = { x0: sx, z0: sz, x1: sx, z1: sz, addMode };
  topControls.enabled = false;
});

canvas.addEventListener('mouseup', e => {
  topControls.enabled = true;

  // ── grid drag commit ───────────────────────────────────────────────────────
  if (_gridDrag && e.button === 0 && _editMode) {
    const ver = currentVersion();
    if (ver.placements) {
      const xa = Math.min(_gridDrag.x0, _gridDrag.x1);
      const xb = Math.max(_gridDrag.x0, _gridDrag.x1);
      const za = Math.min(_gridDrag.z0, _gridDrag.z1);
      const zb = Math.max(_gridDrag.z0, _gridDrag.z1);
      const adding = _gridDrag.addMode;
      for (let x = xa; x <= xb + 1e-6; x = Math.round((x + GRID_STEP) * 1e6) / 1e6) {
        for (let z = za; z <= zb + 1e-6; z = Math.round((z + GRID_STEP) * 1e6) / 1e6) {
          if (!inAnyBed(x, z)) continue;
          if (adding) {
            if (!hasGridCell(ver.placements, _selectedSlug, x, z)) {
              ver.placements.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
                slug: _selectedSlug, x, z,
              });
            }
          } else {
            ver.placements = ver.placements.filter(
              p => !(p.slug === _selectedSlug && Math.abs(p.x - x) < 0.01 && Math.abs(p.z - z) < 0.01),
            );
          }
        }
      }
      commitPlacements();
    }
    if (_gridDragPrev) { scene.remove(_gridDragPrev); _gridDragPrev = null; }
    _gridDrag = null;
    requestRender();
    return;
  }

  // ── point placement (click, no drag) ──────────────────────────────────────
  if (!_dragStart) return;
  const moved = Math.hypot(e.clientX - _dragStart.x, e.clientY - _dragStart.y) > 4;
  _dragStart = null;
  if (moved) return;

  if (e.button === 2) {
    if (_selectedSlug) {
      _selectedSlug = null;
      canvas.classList.remove('selecting');
      renderPlantPanel();
      updateGridMode();
    }
    return;
  }
  if (e.button !== 0 || !_editMode) return;

  const ver = currentVersion();
  if (!ver.placements) return;

  const pt = groundPoint(e);
  if (!pt) return;

  if (_selectedSlug) {
    const sx = snapGridX(pt.x), sz = snapGridZ(pt.z);
    if (!inAnyBed(sx, sz)) return;
    if (!hasGridCell(ver.placements, _selectedSlug, sx, sz)) {
      ver.placements.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        slug: _selectedSlug, x: sx, z: sz,
      });
      commitPlacements();
    }
  } else if (!_selectedSlug) {
    const THRESH = 0.4;
    let nearest = null, nearestD = Infinity;
    for (const p of ver.placements) {
      const d = Math.hypot(p.x - pt.x, p.z - pt.z);
      if (d < nearestD) { nearest = p; nearestD = d; }
    }
    if (nearest && nearestD < THRESH) {
      ver.placements = ver.placements.filter(p => p.id !== nearest.id);
      commitPlacements();
    }
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ── Resize + loop ─────────────────────────────────────────────────────────────

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const a = w / h;
  topCam.left = -12 * a; topCam.right = 12 * a;
  topCam.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);
resize();

(function animate() {
  requestAnimationFrame(animate);
  const t    = performance.now() * 0.001;
  const mats = swayByMonth[currentMonth] ?? [];
  for (const m of mats) m.uniforms.time.value = t;
  controls.update();
  isoControls.update();
  topControls.update();
  renderer.render(scene, activeCamera);
})();
