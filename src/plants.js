import { contrastColor } from './utils.js';

const PAGE = 20;

function buildPlantCard(p, maxW) {
  const dotSize = Math.round((p.world_w ?? 0.3) / maxW * 64);
  const card = document.createElement('div');
  card.className = 'plant-card';
  card.style.setProperty('--plant-color', p.color ?? '#fff');
  card.style.setProperty('--plant-fg', contrastColor(p.color ?? '#fff'));
  card.style.setProperty('--plant-dot-size', `${dotSize}px`);
  card.innerHTML = `
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

export function renderPlantList(plants) {
  const sorted = [...plants].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const maxW = Math.max(...plants.map(p => p.world_w ?? 0.3));
  const list = document.getElementById('plant-list');

  function render(query) {
    const q = query.toLowerCase();
    const filtered = q
      ? sorted.filter(p =>
          (p.name    ?? '').toLowerCase().includes(q) ||
          (p.name_de ?? '').toLowerCase().includes(q) ||
          (p.family  ?? '').toLowerCase().includes(q)
        )
      : sorted;
    list.replaceChildren(...filtered.map(p => buildPlantCard(p, maxW)));
  }

  render('');
  document.getElementById('plant-filter').addEventListener('input', e => render(e.target.value));
}
