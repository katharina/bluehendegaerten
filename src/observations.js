import { thumbUrl, fullUrl } from './utils.js';
import { supabase, authedFetch } from './auth.js';

const PAGE = 20;
let _loggedIn = false;

supabase.auth.getSession().then(({ data: { session } }) => { _loggedIn = !!session?.user; });
supabase.auth.onAuthStateChange((_, session) => { _loggedIn = !!session?.user; });

function buildObsCard(o, gardenMap, plantMap, list) {
  const card  = document.createElement('div');
  card.className = 'carousel-card';
  if (o.id) card.dataset.obsId = o.id;
  const name  = o.slugs?.map(s => plantMap.get(s)).filter(Boolean).join(', ') ?? '';
  const place = gardenMap.get(o.garden) || o.place || '';
  card.innerHTML = `
    <div class="carousel-card-img">
      <img src="${o._localUrl ?? thumbUrl(o.filename)}" loading="lazy">
    </div>
    <div class="carousel-card-meta">
      ${name  ? `<div class="botanical-name">${name}</div>` : ''}
      ${place ? `<div class="observation-place">${place}</div>` : ''}
      ${o.date ? `<div class="observation-date">${new Date(o.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
      ${_loggedIn && o.id ? `<div class="carousel-card-actions">
        <button class="carousel-card-edit">Bearbeiten</button>
        <button class="carousel-card-delete">Löschen</button>
      </div>` : ''}
    </div>`;
  const imgEl = card.querySelector('.carousel-card-img img');
  const imgBox = card.querySelector('.carousel-card-img');
  imgEl.addEventListener('load', () => {
    if (imgEl.naturalWidth > imgEl.naturalHeight) imgBox.classList.add('is-landscape');
  });
  if (o.filename && !o._localUrl) {
    imgEl.addEventListener('error', () => { imgEl.src = fullUrl(o.filename); }, { once: true });
  }

  card.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('obs:open', { detail: { obs: o, list } }));
  });
  card.querySelector('.carousel-card-edit')?.addEventListener('click', e => {
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('obs:edit', { detail: o }));
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

  const sentinel = document.createElement('div');
  carousel.appendChild(sentinel);

  function loadMore() {
    const batch = items.slice(offset, offset + PAGE);
    batch.forEach(o => sentinel.before(buildObsCard(o, gardenMap, plantMap, items)));
    offset += batch.length;
    if (offset >= items.length) {
      sentinel.remove();
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

export function updateObsInCarousel(obs, gardenMap, plantMap) {
  const carouselId = obs.type === 'herbarbeleg' ? 'herbar-carousel' : 'obs-carousel';
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;
  const existing = carousel.querySelector(`[data-obs-id="${obs.id}"]`);
  if (existing) {
    existing.replaceWith(buildObsCard(obs, gardenMap, plantMap, [obs]));
  } else {
    prependObsToCarousel(obs, gardenMap, plantMap);
  }
}

export function removeObsFromCarousel(id) {
  document.querySelectorAll(`[data-obs-id="${id}"]`).forEach(el => el.remove());
}

export function prependObsToCarousel(obs, gardenMap, plantMap) {
  const id = obs.type === 'herbarbeleg' ? 'herbar-carousel' : 'obs-carousel';
  const carousel = document.getElementById(id);
  if (!carousel) return;
  if (carousel.hidden) {
    carousel.hidden = false;
    carousel.innerHTML = '';
  }
  const mergedPlantMap = obs._plants?.length
    ? new Map([...plantMap, ...obs._plants.map(p => [p.slug, p.name])])
    : plantMap;
  const card = buildObsCard(obs, gardenMap, mergedPlantMap, [obs]);
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
  const section = document.getElementById('herbar-section');
  if (section) section.hidden = belege.length === 0;
  renderCarousel(belege, gardenMap, plantMap, 'herbar-carousel');
}
