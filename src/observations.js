import { thumbUrl } from './utils.js';
import { supabase, authedFetch } from './auth.js';

const PAGE = 20;
let _loggedIn = false;

supabase.auth.getSession().then(({ data: { session } }) => { _loggedIn = !!session?.user; });
supabase.auth.onAuthStateChange((_, session) => { _loggedIn = !!session?.user; });

function buildObsCard(o, gardenMap, plantMap, list) {
  const card  = document.createElement('div');
  card.className = 'carousel-card';
  const name  = o.slugs?.map(s => plantMap.get(s)).filter(Boolean).join(', ') ?? '';
  const place = o.place || gardenMap.get(o.garden) || '';
  card.innerHTML = `
    <div class="carousel-card-img">
      <img src="${o._localUrl ?? thumbUrl(o.filename)}" loading="lazy">
      ${_loggedIn ? `<button class="carousel-card-delete">×</button>` : ''}
    </div>
    <div class="carousel-card-meta">
      ${name  ? `<div class="botanical-name">${name}</div>` : ''}
      ${place ? `<div class="observation-place">${place}</div>` : ''}
      ${o.date ? `<div class="observation-date">${new Date(o.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
    </div>`;
  const imgEl = card.querySelector('.carousel-card-img img');
  const imgBox = card.querySelector('.carousel-card-img');
  imgEl.addEventListener('load', () => {
    if (imgEl.naturalWidth > imgEl.naturalHeight) imgBox.classList.add('is-landscape');
  });

  card.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('obs:open', { detail: { obs: o, list } }));
  });
  card.querySelector('.carousel-card-delete')?.addEventListener('click', async e => {
    e.stopPropagation();
    if (!confirm('Beobachtung löschen?')) return;
    await authedFetch(`/api/observations/${o.id}`, { method: 'DELETE' });
    card.remove();
  });
  return card;
}

function renderCarousel(items, gardenMap, plantMap, containerId) {
  const carousel = document.getElementById(containerId);
  if (!carousel) return;
  if (!items.length) {
    carousel.hidden = true;
    return;
  }
  let offset = 0;

  const allCard = document.createElement('div');
  allCard.className = 'carousel-card carousel-card--all';
  allCard.textContent = 'Alle';

  const sentinel = document.createElement('div');
  carousel.appendChild(sentinel);

  function loadMore() {
    const batch = items.slice(offset, offset + PAGE);
    batch.forEach(o => sentinel.before(buildObsCard(o, gardenMap, plantMap, items)));
    offset += batch.length;
    if (offset >= items.length) {
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

export function prependObsToCarousel(obs, gardenMap, plantMap) {
  const id = obs.type === 'herbarbeleg' ? 'herbar-carousel' : 'obs-carousel';
  const carousel = document.getElementById(id);
  if (!carousel) return;
  if (carousel.hidden) {
    carousel.hidden = false;
    carousel.innerHTML = '';
  }
  const card = buildObsCard(obs, gardenMap, plantMap, [obs]);
  carousel.prepend(card);
}

export function renderObsCarousel(observations, gardenMap, plantMap) {
  const fotos = observations
    .filter(o => o.type === 'foto' && o.filename)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderCarousel(fotos, gardenMap, plantMap, 'obs-carousel');
}

export function renderHerbarCarousel(observations, gardenMap, plantMap) {
  const belege = observations
    .filter(o => o.type === 'herbarbeleg' && o.filename)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  renderCarousel(belege, gardenMap, plantMap, 'herbar-carousel');
}
