#!/usr/bin/env node
// Regenerates _thumb.jpg for all observations by calling /api/thumb/:key?regen
// Run: node scripts/regen-thumbs.js [base-url]
// Example: node scripts/regen-thumbs.js https://bluehendegaerten.vercel.app

const BASE = process.argv[2] || 'https://bluehendegaerten.vercel.app';

const obs = await fetch(`${BASE}/api/observations`).then(r => r.json());
const files = [...new Set(obs.map(o => o.filename).filter(Boolean))];

console.log(`Regenerating thumbnails for ${files.length} images via ${BASE}…\n`);

let ok = 0, fail = 0;
for (const filename of files) {
  const url = `${BASE}/api/thumb/${encodeURIComponent(filename)}?regen=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await res.arrayBuffer(); // consume body
    console.log(`  ✓ ${filename}`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${filename}: ${e.message}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} ok, ${fail} failed`);
