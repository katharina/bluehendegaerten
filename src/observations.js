import { thumbUrl } from './utils.js';

const PAGE = 20;

function buildObsCard(o, gardenMap, plantMap) {
  const card  = document.createElement('div');
  card.className = 'carousel-card';
  const name  = o.slugs?.map(s => plantMap.get(s)).filter(Boolean).join(', ') ?? '';
  const place = o.place || gardenMap.get(o.garden) || '';
  card.innerHTML = `
    <div class="carousel-card-img">
      <img src="${thumbUrl(o.filename)}" loading="lazy">
    </div>
    <div class="carousel-card-meta">
      ${name  ? `<div class="botanical-name">${name}</div>` : ''}
      ${place ? `<div class="observation-place">${place}</div>` : ''}
      ${o.date ? `<div class="observation-date">${new Date(o.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
    </div>`;
  card.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('obs:open', { detail: o }));
  });
  return card;
}

export function renderObsCarousel(observations, gardenMap, plantMap) {
  const fotos = observations
    .filter(o => o.type === 'foto' && o.filename)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const carousel = document.getElementById('obs-carousel');
  let offset = 0;

  const allCard = document.createElement('div');
  allCard.className = 'carousel-card carousel-card--all';
  allCard.textContent = 'Alle Beobachtungen';

  const sentinel = document.createElement('div');
  carousel.appendChild(sentinel);

  function loadMore() {
    const batch = fotos.slice(offset, offset + PAGE);
    batch.forEach(o => sentinel.before(buildObsCard(o, gardenMap, plantMap)));
    offset += batch.length;
    if (offset >= fotos.length) {
      sentinel.replaceWith(allCard);
      observer.disconnect();
    }
  }

  const observer = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting) loadMore(); },
    { root: carousel, threshold: 0.1 }
  );

  observer.observe(sentinel);
  loadMore();
}
