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

export async function renderBedPlan(container, { gardenId, plants, bedImages, placements: externalPlacements }) {
  let placements = externalPlacements ?? [];
  if (!externalPlacements && gardenId) {
    try {
      const plan = await fetch(`/api/plans/${gardenId}`).then(r => r.json());
      if (plan?.data) {
        const store = JSON.parse(plan.data);
        const ver = store.versions?.find(v => v.id === store.currentId) ?? store.versions?.[0];
        placements = ver?.placements ?? [];
      }
    } catch {}
  }

  const colorBySlug  = Object.fromEntries(plants.map(p => [p.slug, p.color ?? '#ccc']));
  const plantBySlug  = Object.fromEntries(plants.map(p => [p.slug, p]));

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
      svg += `<image href="/uploads/${bedImages[bed.i]}" x="${x0}" y="${z0}" width="${BED_L}" height="${bed.w}" preserveAspectRatio="xMidYMid slice" opacity="0.45"/>`;
    }
    svg += `<text x="${x0 + 0.1}" y="${z0 + 0.28}" font-size="0.22" fill="#999" font-family="system-ui">${bed.i + 1}</text>`;
    svg += `<line x1="0" y1="${z0}" x2="0" y2="${z0 + bed.w}" stroke="#000" stroke-width="0.025" opacity="0.3"/>`;
  }

  for (const p of placements) {
    const plant = plantBySlug[p.slug];
    const r = (plant?.world_w ?? 0.2) / 2;
    const color = colorBySlug[p.slug] ?? '#ccc';
    svg += `<circle cx="${p.x}" cy="${p.z}" r="${r}" fill="${color}" opacity="0.85" data-slug="${p.slug}"/>`;
  }

  svg += `</svg>`;
  container.innerHTML = svg;

  // Tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'bed-tooltip';
  tooltip.hidden = true;
  document.body.appendChild(tooltip);

  const svgEl = container.querySelector('svg');

  svgEl.addEventListener('mousemove', e => {
    const circle = e.target.closest('circle[data-slug]');
    if (circle) {
      const plant = plantBySlug[circle.dataset.slug];
      if (plant) {
        tooltip.innerHTML =
          `<div class="bed-tooltip-name">${plant.name ?? ''}</div>` +
          (plant.name_de ? `<div class="bed-tooltip-de">${plant.name_de}</div>` : '');
        tooltip.hidden = false;
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top  = (e.clientY + 14) + 'px';
      }
    } else {
      tooltip.hidden = true;
    }
  });

  svgEl.addEventListener('mouseleave', () => { tooltip.hidden = true; });

  svgEl.addEventListener('click', e => {
    const circle = e.target.closest('circle[data-slug]');
    if (!circle) return;
    const plant = plantBySlug[circle.dataset.slug];
    if (plant) document.dispatchEvent(new CustomEvent('plant:open', { detail: plant }));
  });

  document.addEventListener('plant:filter', e => {
    const { slugs, active } = e.detail;
    container.querySelectorAll('circle[data-slug]').forEach(el => {
      el.style.opacity = active && !slugs.has(el.dataset.slug) ? '0.1' : '';
    });
  });
}
