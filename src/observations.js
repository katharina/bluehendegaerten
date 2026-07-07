import { thumbUrl, fullUrl } from './utils.js';
import { supabase, authedFetch } from './auth.js';

const PAGE = 20;
const SITE_OWNER_ID = import.meta.env.VITE_SITE_OWNER_ID ?? null;
let _loggedIn = false;
let _userId = null;

supabase.auth.getSession().then(({ data: { session } }) => { _loggedIn = !!session?.user; _userId = session?.user?.id ?? null; });
supabase.auth.onAuthStateChange((_, session) => { _loggedIn = !!session?.user; _userId = session?.user?.id ?? null; });

export function setCurrentUser(userId) { _userId = userId; _loggedIn = !!userId; }
export function getCurrentUserId() { return _userId; }

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
      ${o.id && _loggedIn && _userId === o.created_by ? `<div class="carousel-card-actions">
        <button class="carousel-card-edit">Bearbeiten</button>
        <button class="carousel-card-delete">Löschen</button>
      </div>` : ''}
      ${o.id && SITE_OWNER_ID && _userId === SITE_OWNER_ID ? `<button class="carousel-card-highlight${o.highlighted ? ' is-active' : ''}" title="Highlight">★</button>` : ''}
      ${o.id && o.created_by && _userId !== o.created_by ? `<div class="carousel-card-creator">${o.created_by_name || 'Blümchen'}</div>` : ''}
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
  card.querySelector('.carousel-card-highlight')?.addEventListener('click', async e => {
    e.stopPropagation();
    const btn = e.currentTarget;
    const newVal = !o.highlighted;
    o.highlighted = newVal;
    btn.classList.toggle('is-active', newVal);
    const res = await authedFetch(`/api/observations/${o.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlighted: newVal }),
    });
    if (!res.ok) {
      o.highlighted = !newVal;
      btn.classList.toggle('is-active', !newVal);
    }
  });
  card.querySelector('.carousel-card-delete')?.addEventListener('click', async e => {
    e.stopPropagation();
    if (!confirm('Beobachtung löschen?')) return;
    const res = await authedFetch(`/api/observations/${o.id}`, { method: 'DELETE' });
    if (!res.ok) return;
    card.remove();
    document.dispatchEvent(new CustomEvent('obs:deleted', { detail: { id: o.id, type: o.type } }));
  });
  return card;
}

function renderCarousel(items, gardenMap, plantMap, containerId) {
  const carousel = document.getElementById(containerId);
  if (!carousel) return;
  carousel.hidden = !items.length;
  carousel.innerHTML = '';
  if (!items.length) return;
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

function carouselIdForType(type) {
  if (type === 'herbarbeleg') return 'herbar-carousel';
  if (type === 'notiz') return 'notiz-carousel';
  if (type === 'pflanzenlabel') return 'pflanzenlabel-carousel';
  return 'obs-carousel';
}

export function updateObsInCarousel(obs, gardenMap, plantMap) {
  const carouselId = carouselIdForType(obs.type);
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;
  const existing = carousel.querySelector(`[data-obs-id="${obs.id}"]`);
  if (existing) {
    existing.replaceWith(buildObsCard(obs, gardenMap, plantMap, [obs]));
  } else {
    removeObsFromCarousel(obs.id);
    prependObsToCarousel(obs, gardenMap, plantMap);
  }
}

export function removeObsFromCarousel(id) {
  document.querySelectorAll(`[data-obs-id="${id}"]`).forEach(el => el.remove());
}

export function prependObsToCarousel(obs, gardenMap, plantMap) {
  const id = carouselIdForType(obs.type);
  if (!id) return;
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

export function initLazyObsCarousel(containerId, { gardenMap, plantMap, sharedList, onLoad }) {
  const carousel = document.getElementById(containerId);
  if (!carousel) return;
  carousel.hidden = false;

  const BATCH = 10;
  let offset = 0;
  let loading = false;

  const sentinel = document.createElement('div');
  carousel.appendChild(sentinel);

  async function loadMore() {
    if (loading) return;
    loading = true;
    const batch = await fetch(`/api/observations?limit=${BATCH}&offset=${offset}`)
      .then(r => r.json()).catch(() => []);
    const fotos = batch.filter(o => o.type === 'foto' && o.filename);
    fotos.forEach(o => {
      sharedList.push(o);
      sentinel.before(buildObsCard(o, gardenMap, plantMap, sharedList));
    });
    offset += batch.length;
    loading = false;
    onLoad?.();
    if (batch.length < BATCH) { sentinel.remove(); observer.disconnect(); }
  }

  const observer = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting) loadMore(); },
    { root: carousel, threshold: 0.1 }
  );
  observer.observe(sentinel);
  loadMore(); // always kick off the first batch immediately
}

export function renderPflanzenlabelCarousel(observations, gardenMap, plantMap) {
  const labels = observations
    .filter(o => o.type === 'pflanzenlabel')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const section = document.getElementById('pflanzenlabel-section');
  if (section) section.hidden = labels.length === 0;
  renderCarousel(labels, gardenMap, plantMap, 'pflanzenlabel-carousel');
}

export function renderNotizCarousel(observations, gardenMap, plantMap) {
  const notes = observations
    .filter(o => o.type === 'notiz')
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const section = document.getElementById('notiz-section');
  if (section) section.hidden = notes.length === 0;
  renderCarousel(notes, gardenMap, plantMap, 'notiz-carousel');
}

export function renderHerbarCarousel(observations, gardenMap, plantMap) {
  const belege = observations
    .filter(o => o.type === 'herbarbeleg' && o.filename)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const section = document.getElementById('herbar-section');
  if (section) section.hidden = belege.length === 0;
  renderCarousel(belege, gardenMap, plantMap, 'herbar-carousel');
}

export function renderObsGrid(observations, gardenMap, plantMap, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (!observations.length) {
    container.textContent = 'Keine Beobachtungen';
    return;
  }
  observations.forEach(o => container.appendChild(buildObsCard(o, gardenMap, plantMap, observations)));
}
