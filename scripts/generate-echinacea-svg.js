// Generates flat graphic SVG PNGs for echinacea, matching the hand-drawn bloom style.
// Usage: node scripts/generate-echinacea-svg.js

import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'public', 'plants');

const W = 800, H = 2000, CX = 400;

const STEM = '#7a5a28';
const LEAF = '#3d6b2e';
const RAY  = '#e06090';
const DOME = '#e0580a';
const HEAD = '#5a3c18'; // seed / dried heads

function mksvg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`;
}

// Leaf: base at origin, tip pointing up
function leafD(h, w) {
  return `M 0,0 C ${-w},${-h / 3} ${-w / 2},${-h * 0.85} 0,${-h} C ${w / 2},${-h * 0.85} ${w},${-h / 3} 0,0`;
}
function leafEl(cx, cy, angle, h, w, color = LEAF) {
  return `<path fill="${color}" transform="translate(${cx},${cy}) rotate(${angle})" d="${leafD(h, w)}"/>`;
}

// Stem: filled thin quad, leans by `lean` px over its height
function stemEl(x, baseY, h, lean = 0, sw = 7) {
  return `<path fill="${STEM}" d="M ${x - sw/2},${baseY} L ${x+lean - sw/2},${baseY-h} L ${x+lean + sw/2},${baseY-h} L ${x + sw/2},${baseY} Z"/>`;
}

// Coneflower: rectangular stripe rays + orange dome on top
function coneflower(cx, cy, domeR, rayLen, rayW = 9, n = 16) {
  let rays = '';
  for (let i = 0; i < n; i++) {
    const a = (-155 + (i / (n - 1)) * 310) * Math.PI / 180;
    const ox = Math.cos(a), oy = Math.sin(a);
    const x1 = cx + ox * domeR,           y1 = cy + oy * domeR;
    const x2 = cx + ox * (domeR + rayLen), y2 = cy + oy * (domeR + rayLen);
    const px = -Math.sin(a) * rayW / 2,   py = Math.cos(a) * rayW / 2;
    rays += `<path fill="${RAY}" d="M ${x1-px},${y1-py} L ${x2-px},${y2-py} L ${x2+px},${y2+py} L ${x1+px},${y1+py} Z"/>`;
  }
  return rays + `<circle fill="${DOME}" cx="${cx}" cy="${cy}" r="${domeR}"/>`;
}

// Spiky head for seed / dried stages
function spikyHead(cx, cy, r, n = 14, sLen = 12, color = HEAD) {
  const spikes = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const ox = Math.cos(a), oy = Math.sin(a);
    const px = -Math.sin(a) * 3, py = Math.cos(a) * 3;
    const ax = cx + ox * r, ay = cy + oy * r;
    const bx = cx + ox * (r + sLen), by = cy + oy * (r + sLen);
    return `M ${ax-px},${ay-py} L ${bx},${by} L ${ax+px},${ay+py} Z`;
  }).join(' ');
  return `<circle fill="${color}" cx="${cx}" cy="${cy}" r="${r}"/>
          <path fill="${color}" d="${spikes}"/>`;
}

// Bold leaf base radiating from (cx, baseY) — used by most stages
function leafBase(cx, baseY, leaves) {
  return leaves.map(([angle, h, w]) => leafEl(cx, baseY, angle, h, w)).join('');
}

// ── SPROUT (12cm = 96px) ──────────────────────────────────────────────────────
// Just a compact rosette — smaller leaves, low and wide
function makeSprout() {
  return mksvg(leafBase(CX, H, [
    [  0, 88, 18],
    [ 22, 82, 17],
    [-22, 82, 17],
    [ 48, 68, 15],
    [-48, 68, 15],
    [ 72, 52, 12],
    [-72, 52, 12],
  ]));
}

// ── FOLIAGE (45cm = 360px) ────────────────────────────────────────────────────
// Upright leafy clump: bold leaf base + 3 stems with leaves + buds
function makeFoliage() {
  const by = H;
  const stems = [
    { x: CX,      h: 360, lean:  0  },
    { x: CX - 18, h: 295, lean: -16 },
    { x: CX + 18, h: 310, lean:  18 },
  ];

  let parts = leafBase(CX, by, [
    [  0, 100, 20],
    [ 28,  94, 18],
    [-28,  94, 18],
    [ 58,  78, 15],
    [-58,  78, 15],
  ]);

  for (const { x, h, lean } of stems) {
    const topX = x + lean, topY = by - h;
    parts += stemEl(x, by, h, lean, 8);
    // A couple of leaves along the stem
    for (let i = 0; i < 3; i++) {
      const t = 0.3 + i * 0.22;
      const lx = x + lean * t, ly = by - h * t;
      const side = i % 2 === 0 ? 1 : -1;
      parts += leafEl(lx, ly, side * 44, 62 - i * 8, 13);
    }
    // Small bud
    parts += `<circle fill="${LEAF}" cx="${topX}" cy="${topY}" r="10"/>`;
    parts += `<circle fill="${DOME}" cx="${topX}" cy="${topY - 6}" r="7"/>`;
  }
  return mksvg(parts);
}

// ── BLOOM (80cm = 640px) ──────────────────────────────────────────────────────
// Bold leaf base + bare stems + coneflowers
function makeBloom() {
  const by = H;
  const stems = [
    { x: CX,      h: 638, lean:  0  },
    { x: CX - 20, h: 555, lean: -18 },
    { x: CX + 20, h: 512, lean:  20 },
    { x: CX - 48, h: 415, lean: -30 },
    { x: CX + 46, h: 392, lean:  30 },
  ];

  // Leaf base — bold, prominent
  let parts = leafBase(CX, by, [
    [  0, 120, 26],
    [ 24, 114, 25],
    [-24, 114, 25],
    [ 50,  98, 22],
    [-50,  98, 22],
    [ 74,  78, 18],
    [-74,  78, 18],
    [ 90,  56, 14],
    [-90,  56, 14],
  ]);

  for (const { x, h, lean } of stems) {
    parts += stemEl(x, by, h, lean, 7);
    parts += coneflower(x + lean, by - h, 30, 44);
  }
  return mksvg(parts);
}

// ── SEED (75cm = 600px) ───────────────────────────────────────────────────────
// Leaf base + stems + dark spiky seed heads
function makeSeed() {
  const by = H;
  const stems = [
    { x: CX,      h: 598, lean:  0  },
    { x: CX - 20, h: 518, lean: -18 },
    { x: CX + 20, h: 480, lean:  20 },
    { x: CX - 48, h: 388, lean: -28 },
    { x: CX + 46, h: 368, lean:  28 },
  ];

  let parts = leafBase(CX, by, [
    [  0, 100, 20],
    [ 26,  94, 19],
    [-26,  94, 19],
    [ 54,  80, 16],
    [-54,  80, 16],
    [ 76,  60, 12],
    [-76,  60, 12],
  ]);

  for (const { x, h, lean } of stems) {
    parts += stemEl(x, by, h, lean, 7);
    parts += spikyHead(x + lean, by - h, 20, 14, 14);
  }
  return mksvg(parts);
}

// ── DRIED (75cm = 600px) ──────────────────────────────────────────────────────
// No leaves — just bare stems fanning from base, each topped with a spiky head
function makeDried() {
  const by = H;
  const stems = [
    { x: CX - 52, h: 378, lean: -35 },
    { x: CX - 24, h: 498, lean: -20 },
    { x: CX -  5, h: 580, lean:  -6 },
    { x: CX +  8, h: 598, lean:   7 },
    { x: CX + 28, h: 520, lean:  22 },
    { x: CX + 54, h: 390, lean:  36 },
  ];

  let parts = '';
  for (const { x, h, lean } of stems) {
    parts += stemEl(x, by, h, lean, 5);
    parts += spikyHead(x + lean, by - h, 20, 14, 14);
  }
  return mksvg(parts);
}

// ── Render ────────────────────────────────────────────────────────────────────
const stages = [
  { id: 'sprout',  fn: makeSprout  },
  { id: 'foliage', fn: makeFoliage },
  { id: 'bloom',   fn: makeBloom   },
  { id: 'seed',    fn: makeSeed    },
  { id: 'dried',   fn: makeDried   },
];

for (const { id, fn } of stages) {
  await sharp(Buffer.from(fn())).png().toFile(join(OUT, `echinacea_${id}.png`));
  console.log(`saved echinacea_${id}.png`);
}
console.log('done.');
