import { fullUrl } from './utils.js';

const BED_L = 9, BED_GAP = 0.5;
const BED_WIDTHS = [1.5, 1.5, 1.5, 1.5, 3.0, 1.5, 1.5, 1.5, 3.0];
const TOTAL_Z = BED_WIDTHS.reduce((a, b) => a + b, 0) + BED_GAP * (BED_WIDTHS.length - 1);

const bedLayout = (() => {
  let cursor = -TOTAL_Z / 2;
  return BED_WIDTHS.map((w, i) => {
    const z = cursor + w / 2;
    cursor += w + BED_GAP;
    return { w, z, i };
  });
})();

function inBed(x, z) {
  return Math.abs(x) <= BED_L / 2 - 0.01 &&
    bedLayout.some(b => z >= b.z - b.w / 2 + 0.01 && z <= b.z + b.w / 2 - 0.01);
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
}) {
  const colorBySlug = Object.fromEntries(plants.map(p => [p.slug, p.color ?? '#ccc']));
  const plantBySlug = Object.fromEntries(plants.map(p => [p.slug, p]));

  const PAD = 0.65;
  const vbX = -BED_L / 2 - PAD;
  const vbY = -TOTAL_Z / 2 - PAD;
  const vbW = BED_L + PAD * 2;
  const vbH = TOTAL_Z + PAD * 2;

  let svg = `<svg class="bed-plan-svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg">`;

  for (const bed of bedLayout) {
    const x0 = -BED_L / 2;
    const z0 = bed.z - bed.w / 2;
    svg += `<rect x="${x0}" y="${z0}" width="${BED_L}" height="${bed.w}" fill="#f5f5f3" stroke="#000" stroke-width="0.01"/>`;
    if (bedImages[bed.i]) {
      svg += `<image href="${fullUrl(bedImages[bed.i])}" x="${x0}" y="${z0}" width="${BED_L}" height="${bed.w}" preserveAspectRatio="xMidYMid slice" opacity="0.45"/>`;
    }
    svg += `<text x="${x0 + 0.1}" y="${z0 + 0.28}" font-size="0.22" fill="#999" font-family="system-ui">${bed.i + 1}</text>`;
    svg += `<line x1="0" y1="${z0}" x2="0" y2="${z0 + bed.w}" stroke="#000" stroke-width="0.025" opacity="0.3"/>`;
    if (editMode) {
      const btnW = 0.6, btnH = 0.26, btnX = x0 + BED_L - btnW - 0.1, btnY = z0 + 0.08;
      svg += `<rect x="${btnX}" y="${btnY}" width="${btnW}" height="${btnH}" rx="0.06" fill="${bedImages[bed.i] ? '#444' : '#888'}" opacity="0.75" data-upload-bed="${bed.i}" style="cursor:pointer"/>`;
      svg += `<text x="${btnX + btnW / 2}" y="${btnY + 0.175}" font-size="0.155" fill="#fff" font-family="system-ui" text-anchor="middle" pointer-events="none">${bedImages[bed.i] ? '✎ Bild' : '+ Bild'}</text>`;
    }
  }

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
      if (coords && inBed(coords.x, coords.z)) onPlace?.(selectedSlug, coords.x, coords.z);
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
