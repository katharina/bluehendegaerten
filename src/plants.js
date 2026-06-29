import { contrastColor } from './utils.js';

const PAGE = 20;

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

function isNew(p) {
  return p.created_at && (Date.now() - new Date(p.created_at).getTime()) < THREE_DAYS;
}

function buildPlantCard(p, maxW) {
  const dotSize = Math.round((p.world_w ?? 0.3) / maxW * 48);
  const card = document.createElement('div');
  card.className = 'plant-card';
  card.dataset.slug = p.slug;
  card.style.setProperty('--plant-color', p.color ?? '#fff');
  card.style.setProperty('--plant-fg', contrastColor(p.color ?? '#fff'));
  card.style.setProperty('--plant-dot-size', `${dotSize}px`);
  card.innerHTML = `
    ${isNew(p) ? `<span class="plant-new">NEU</span>` : ''}
    ${p.name    ? `<div class="botanical-name">${p.name}</div>` : ''}
    ${p.name_de ? `<div class="german-name">${p.name_de}</div>` : ''}
    ${p.family  ? `<div class="plant-family">${p.family}</div>` : ''}
    <span class="plant-dot"></span>
  `;
  card.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('plant:open', { detail: p }));
  });
  return card;
}

export function renderPlantList(plants, { bedSlugs = null } = {}) {
  const sorted = [...plants].sort((a, b) => {
    const aN = isNew(a), bN = isNew(b);
    if (aN && !bN) return -1;
    if (!aN && bN) return 1;
    if (aN && bN) return new Date(b.created_at) - new Date(a.created_at);
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
  const maxW = Math.max(...plants.map(p => p.world_w ?? 0.3));
  const list = document.getElementById('plant-list');
  const filterInput = document.getElementById('plant-filter');
  const bedLabel    = document.getElementById('plant-filter-bed-label');
  const bedCheckbox = document.getElementById('plant-filter-bed');

  if (bedLabel && bedSlugs?.size) bedLabel.hidden = false;

  function render() {
    const q       = filterInput.value.toLowerCase();
    const bedOnly = bedCheckbox?.checked && bedSlugs?.size;
    let filtered  = bedOnly ? sorted.filter(p => bedSlugs.has(p.slug)) : sorted;
    if (q) filtered = filtered.filter(p =>
      (p.name    ?? '').toLowerCase().includes(q) ||
      (p.name_de ?? '').toLowerCase().includes(q) ||
      (p.family  ?? '').toLowerCase().includes(q)
    );
    list.replaceChildren(...filtered.map(p => buildPlantCard(p, maxW)));
    document.dispatchEvent(new CustomEvent('plant:filter', {
      detail: { slugs: new Set(filtered.map(p => p.slug)), active: !!(q || bedOnly) },
    }));
  }

  render();
  filterInput.addEventListener('input', render);
  bedCheckbox?.addEventListener('change', render);
}
