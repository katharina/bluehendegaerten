import { fullUrl } from './utils.js';

const DEFAULT_BED_L = 9, BED_GAP = 0.5;
const DEFAULT_BED_WIDTHS = [1.5, 1.5, 1.5, 1.5, 3.0, 1.5, 1.5, 1.5, 3.0];

function buildLayout(bedL, bedWidths) {
  const totalZ = bedWidths.reduce((a, b) => a + b, 0) + BED_GAP * (bedWidths.length - 1);
  let cursor = -totalZ / 2;
  const beds = bedWidths.map((w, i) => {
    const z = cursor + w / 2;
    cursor += w + BED_GAP;
    return { w, z, i };
  });
  return { bedL, totalZ, beds };
}

function inBed(x, z, bedL, beds) {
  return Math.abs(x) <= bedL / 2 - 0.01 &&
    beds.some(b => z >= b.z - b.w / 2 + 0.01 && z <= b.z + b.w / 2 - 0.01);
}

function svgCoords(e, svgEl) {
  const rect = svgEl.getBoundingClientRect();
  const vb = svgEl.viewBox.baseVal;
  return {
    x: (e.clientX - rect.left) / rect.width  * vb.width  + vb.x,
    z: (e.clientY - rect.top)  / rect.height * vb.height + vb.y,
  };
}

let _tooltip = null;

export function renderBedPlan(container, {
  plants = [], bedImages = {}, placements = [],
  editMode = false, selectedSlug = null,
  onPlace = null, onRemove = null, onUploadBed = null,
  bedConfig = null,
}) {
  const colorBySlug = Object.fromEntries(plants.map(p => [p.slug, p.color ?? '#ccc']));
  const plantBySlug = Object.fromEntries(plants.map(p => [p.slug, p]));

  const bedL = bedConfig?.bedL ?? DEFAULT_BED_L;
  const bedWidths = bedConfig?.bedWidths ?? DEFAULT_BED_WIDTHS;
  const { totalZ, beds } = buildLayout(bedL, bedWidths);

  const PAD = 0.4;
  const vbX = -bedL / 2 - PAD;
  const vbY = -totalZ / 2 - PAD;
  const vbW = bedL + PAD * 2;
  const vbH = totalZ + PAD * 2;

  let svg = `<svg class="bed-plan-svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">`;

  // Background layer: bed rectangles + images
  for (const bed of beds) {
    const x0 = -bedL / 2;
    const z0 = bed.z - bed.w / 2;
    svg += `<rect x="${x0}" y="${z0}" width="${bedL}" height="${bed.w}" fill="none" stroke="#000" stroke-width="0.01"/>`;
    if (bedImages[bed.i]) {
      svg += `<image href="${fullUrl(bedImages[bed.i])}" x="${x0}" y="${z0}" width="${bedL}" height="${bed.w}" preserveAspectRatio="xMidYMid slice" opacity="0.45"/>`;
    }
  }

  // Plant circles
  for (const p of placements) {
    const plant = plantBySlug[p.slug];
    const r = (plant?.world_w ?? 0.2) / 2;
    const color = colorBySlug[p.slug] ?? '#ccc';
    const isSelected = editMode && p.slug === selectedSlug;
    svg += `<circle cx="${p.x.toFixed(3)}" cy="${p.z.toFixed(3)}" r="${r}" fill="${color}" opacity="0.85"` +
      ` stroke="${isSelected ? '#000' : 'none'}" stroke-width="0.05"` +
      ` data-slug="${p.slug}" data-id="${p.id ?? ''}"` +
      ` data-name="${(plant?.name ?? '').replace(/"/g, '&quot;')}" data-de="${(plant?.name_de ?? '').replace(/"/g, '&quot;')}"/>`;
  }

  // Foreground layer: bed numbers + edit buttons (always on top)
  for (const bed of beds) {
    const x0 = -bedL / 2;
    const z0 = bed.z - bed.w / 2;
    svg += `<text class="bed-number" x="${x0 + 0.1}" y="${z0 + 0.28}">${bed.i + 1}</text>`;
    if (editMode) {
      const btnW = 0.6, btnH = 0.26, btnX = x0 + bedL - btnW - 0.1, btnY = z0 + 0.08;
      svg += `<rect x="${btnX}" y="${btnY}" width="${btnW}" height="${btnH}" rx="0.06" fill="${bedImages[bed.i] ? '#444' : '#888'}" opacity="0.75" data-upload-bed="${bed.i}" style="cursor:pointer"/>`;
      svg += `<text x="${btnX + btnW / 2}" y="${btnY + 0.175}" font-size="0.155" fill="#fff" font-family="system-ui" text-anchor="middle" pointer-events="none">${bedImages[bed.i] ? '✎ Bild' : '+ Bild'}</text>`;
    }
  }

  svg += `</svg>`;
  container.innerHTML = svg;
  container.classList.toggle('is-editable', editMode);

  if (!_tooltip) {
    _tooltip = document.createElement('div');
    _tooltip.className = 'bed-tooltip';
    _tooltip.hidden = true;
    document.body.appendChild(_tooltip);
  }

  const svgEl = container.querySelector('svg');

  svgEl.addEventListener('mousemove', e => {
    const circle = e.target.closest('circle[data-slug]');
    if (circle) {
      _tooltip.innerHTML = `<div class="bed-tooltip-name">${circle.dataset.name}</div>` +
        (circle.dataset.de ? `<div class="bed-tooltip-de">${circle.dataset.de}</div>` : '');
      _tooltip.hidden = false;
      _tooltip.style.left = (e.clientX + 14) + 'px';
      _tooltip.style.top  = (e.clientY + 14) + 'px';
    } else {
      _tooltip.hidden = true;
    }
  });

  svgEl.addEventListener('mouseleave', () => { _tooltip.hidden = true; });

  svgEl.addEventListener('click', e => {
    _tooltip.hidden = true;
    if (editMode) {
      const uploadEl = e.target.closest('[data-upload-bed]');
      if (uploadEl) { onUploadBed?.(parseInt(uploadEl.dataset.uploadBed)); return; }
      const circle = e.target.closest('circle[data-id]');
      if (circle && circle.dataset.slug === selectedSlug && circle.dataset.id) {
        onRemove?.(circle.dataset.id);
        return;
      }
      if (!selectedSlug) return;
      const coords = svgCoords(e, svgEl);
      if (coords && inBed(coords.x, coords.z, bedL, beds)) onPlace?.(selectedSlug, coords.x, coords.z);
    } else {
      const circle = e.target.closest('circle[data-slug]');
      if (!circle) return;
      const plant = plantBySlug[circle.dataset.slug];
      if (plant) document.dispatchEvent(new CustomEvent('plant:open', { detail: plant }));
    }
  });

  document.addEventListener('plant:filter', e => {
    const { slugs, active } = e.detail;
    container.querySelectorAll('circle[data-slug]').forEach(el => {
      el.style.opacity = active && !slugs.has(el.dataset.slug) ? '0.1' : '';
    });
  });
}
