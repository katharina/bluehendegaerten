import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Scene ─────────────────────────────────────────────────────────────────────

const canvas = document.getElementById('c');
const wrap   = document.getElementById('canvas-wrap');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xffffff);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(55, 1, 0.001, 200);
camera.position.set(0, -0.2, 10);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, -2.5, -6);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
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

const ORBIT_TARGET = new THREE.Vector3(0, -2.5, -6);

function setView(name) {
  const isIso = name.startsWith('iso-');
  activeCamera = isIso ? isoCams[name] : camera;
  controls.enabled    = !isIso;
  isoControls.enabled =  isIso;
  if (isIso) {
    isoControls.object = activeCamera;
    activeCamera.position.copy(activeCamera.userData.home);
    activeCamera.zoom = 1;
    activeCamera.updateProjectionMatrix();
    isoControls.target.copy(ISO_TARGET);
    isoControls.update();
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
  btn.addEventListener('click', () => setView(btn.dataset.view)));
setView('iso-se');
document.getElementById('export-btn')?.addEventListener('click', exportSVG);

scene.add(new THREE.AmbientLight(0xffffff, 0.75));
const sun = new THREE.DirectionalLight(0xfff6e8, 0.8);
sun.position.set(3, 5, 4);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(2048);
sun.shadow.bias = -0.001;
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 50;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe8f0ff, 0.3);
fill.position.set(-3, 2, -2);
scene.add(fill);

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

const bedMat    = new THREE.MeshLambertMaterial({ color: 0x5c3d25 });
const shadowMat = new THREE.ShadowMaterial({ opacity: 0.18, transparent: true });
const borderMat = new THREE.LineBasicMaterial({ color: 0x666666 });
const wallMat   = new THREE.MeshLambertMaterial({ color: 0xc8bfb4 });

for (const bed of beds) {
  const geo = new THREE.PlaneGeometry(BED_L, bed.w);

  const mesh = new THREE.Mesh(geo, bedMat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, bed.y, bed.z);
  scene.add(mesh);

  const shadow = new THREE.Mesh(geo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, bed.y + 0.001, bed.z);
  shadow.receiveShadow = true;
  scene.add(shadow);

  const border = new THREE.LineSegments(new THREE.EdgesGeometry(geo), borderMat);
  border.rotation.x = -Math.PI / 2;
  border.position.set(0, bed.y + 0.002, bed.z);
  scene.add(border);

  // low retaining wall around bed perimeter
  const wallY = bed.y + WALL_H / 2;
  const walls = [
    // north & south — full width including corner overlap
    { geo: new THREE.BoxGeometry(BED_L + WALL_T * 2, WALL_H, WALL_T),
      pos: [0, wallY, bed.z - bed.w / 2 - WALL_T / 2] },
    { geo: new THREE.BoxGeometry(BED_L + WALL_T * 2, WALL_H, WALL_T),
      pos: [0, wallY, bed.z + bed.w / 2 + WALL_T / 2] },
    // east & west — just the gap between the north/south walls
    { geo: new THREE.BoxGeometry(WALL_T, WALL_H, bed.w),
      pos: [-BED_L / 2 - WALL_T / 2, wallY, bed.z] },
    { geo: new THREE.BoxGeometry(WALL_T, WALL_H, bed.w),
      pos: [ BED_L / 2 + WALL_T / 2, wallY, bed.z] },
  ];
  for (const { geo: wg, pos } of walls) {
    const wall = new THREE.Mesh(wg, wallMat);
    wall.position.set(...pos);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
  }
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
uniform sampler2D map;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  gl_FragColor = vec4(c.rgb * vColor, 1.0);
}`;

// Vertical: cylindrical billboard, pivot at base, always faces camera around Y
const VERT_VERTICAL = `
uniform float time;
attribute vec3 iPos;
attribute float iScale;
attribute vec3 iColor;
varying vec2 vUv;
varying vec3 vColor;
void main() {
  vUv    = uv;
  vColor = iColor;
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  right.y    = 0.0;
  right      = normalize(right);
  // gentle sway: grows with height, unique phase per plant
  float phase = iPos.x * 1.7 + iPos.z * 2.3;
  float sway  = position.y * iScale * sin(time * 1.2 + phase) * 0.04;
  vec3 world = iPos
    + right               * (position.x * iScale + sway)
    + vec3(0.0, 1.0, 0.0) *  position.y * iScale;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  // per-instance depth nudge — prevents Z-fighting between coplanar billboards
  float h = fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
  gl_Position.z -= h * 0.0002 * gl_Position.w;
}`;

// Horizontal: lies near-flat on ground with a gentle tilt, random Y rotation per instance
const VERT_HORIZONTAL = `
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
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const swayMaterials = [];

// orient: 'vertical' (default) or 'horizontal'
// worldW / worldH: real-world metres the plane spans
// tilt: for horizontal, radians from flat (0 = pancake, PI/2 = upright) — default 0.35 (~20°)
function makeBillboardMesh(texture, positions, { orient = 'vertical', worldW = 0.8, worldH = 1.0, tilt = 0.35 } = {}) {
  const count = positions.length;
  const horiz = orient === 'horizontal';
  const geo   = new THREE.PlaneGeometry(worldW, worldH);
  if (!horiz) geo.translate(0, worldH / 2, 0); // vertical: pivot at base

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
    const b = 0.82 + rand() * 0.36;
    colorArr[i*3] = b;  colorArr[i*3+1] = b;  colorArr[i*3+2] = b;
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
  if (!horiz) swayMaterials.push(mat);

  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  return mesh;
}

const DENSITY_MULT = 8;
const CLUMP_RADIUS = 0.35;

// Generate world-space placement for every plant across all beds.
// Two passes: jittered grid anchors guarantee full coverage,
// then extra clumped plants build density around them.
function scatterBeds(seed, density = 2) {
  const rand   = rng(seed);
  const margin = 0.05;
  return beds.flatMap(bed => {
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
const MONTHS     = ['february', 'march', 'april', 'may', 'june', 'july', 'august', 'september'];

function showMonth(key) {
  currentMonth = key;
  if (activeGroup) scene.remove(activeGroup);
  activeGroup = gardens[key] ?? null;
  if (activeGroup) scene.add(activeGroup);
  document.querySelectorAll('.month-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.month === key));
}

async function init() {
  const manifest = await fetch(`${import.meta.env.BASE_URL}plants/manifest.json`).then(r => r.json());

  // precompute scatter positions per unique seed
  const posBySeed = {};
  for (const entry of manifest) {
    if (!posBySeed[entry.seed]) {
      posBySeed[entry.seed] = scatterBeds(entry.seed, entry.density);
    }
  }

  // load all textures in parallel, skip missing ones
  const loader   = new THREE.TextureLoader();
  const textures = {};
  await Promise.all(manifest.map(async entry => {
    const key = `${entry.slug}_${entry.stage}`;
    try {
      const tex = await loader.loadAsync(`${import.meta.env.BASE_URL}plants/${entry.slug}_${entry.stage}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      textures[key]  = tex;
    } catch { /* image not generated yet */ }
  }));

  for (const month of MONTHS) {
    const g = new THREE.Group();
    for (const entry of manifest) {
      if (!entry.months.includes(month)) continue;
      const key = `${entry.slug}_${entry.stage}`;
      if (!textures[key]) continue;
      g.add(makeBillboardMesh(textures[key], posBySeed[entry.seed], {
        orient: 'vertical', worldW: entry.worldW, worldH: entry.worldH,
      }));
    }
    gardens[month] = g;
  }
  showMonth('june');
}
init();

document.querySelectorAll('.month-btn').forEach(btn =>
  btn.addEventListener('click', () => showMonth(btn.dataset.month)));

// ── Resize + loop ─────────────────────────────────────────────────────────────

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);
resize();

(function animate() {
  requestAnimationFrame(animate);
  const t = performance.now() * 0.001;
  for (const m of swayMaterials) m.uniforms.time.value = t;
  controls.update();
  isoControls.update();
  renderer.render(scene, activeCamera);
})();
