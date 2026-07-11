import { thumbUrl, fullUrl, contrastColor } from './utils.js';
import { supabase, authedFetch } from './auth.js';

const PAGE = 20;
const SITE_OWNER_ID = import.meta.env.VITE_SITE_OWNER_ID ?? null;
let _loggedIn = false;
let _userId = null;

supabase.auth.getSession().then(({ data: { session } }) => { _loggedIn = !!session?.user; _userId = session?.user?.id ?? null; });
supabase.auth.onAuthStateChange((_, session) => { _loggedIn = !!session?.user; _userId = session?.user?.id ?? null; });

export function setCurrentUser(userId) { _userId = userId; _loggedIn = !!userId; }
export function getCurrentUserId() { return _userId; }

function buildObsCard(o, gardenMap, plantMap, list, colorMap = null) {
  const card  = document.createElement('div');
  card.className = 'carousel-card' + (o.highlighted ? ' is-highlighted' : '');
  if (o.id) card.dataset.obsId = o.id;
  const plantTags = (o.slugs ?? [])
    .map(s => ({ name: plantMap.get(s), color: colorMap?.get(s) }))
    .filter(p => p.name)
    .slice(0, 3);
  const place = gardenMap.get(o.garden) || o.place || '';
  const bgColor = [...(o.slugs ?? [])].reverse().map(s => colorMap?.get(s)).find(Boolean) ?? '#444';
  card.innerHTML = `
    <div class="carousel-card-img" style="background:${bgColor}">
      <img src="${o._localUrl ?? thumbUrl(o.filename)}" loading="lazy">
    </div>
    <div class="carousel-card-meta">
      ${plantTags.map(p => `<div class="botanical-name"${p.color ? ` style="background:${p.color};color:${contrastColor(p.color)}"` : ''}>${p.name}</div>`).join('')}
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
    if (imgEl.naturalWidth > imgEl.naturalHeight) {
      imgBox.classList.add('is-landscape');
      card.classList.add('is-landscape');
    }
    imgEl.classList.add('is-loaded');
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
    { root: carousel, rootMargin: '0px 400px 0px 0px', threshold: 0 }
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

export function initLazyObsCarousel(containerId, { gardenMap, plantMap, colorMap = null, sharedList, onLoad, maxBatches = null, showAllHref = null, garden = null, type = 'foto', sectionId = null }) {
  const carousel = document.getElementById(containerId);
  if (!carousel) return;
  carousel.hidden = false;

  const BATCH = 10;
  let offset = 0;
  let batches = 0;
  let fotosLoaded = 0;
  let loading = false;

  const sentinel = document.createElement('div');
  carousel.appendChild(sentinel);

  async function loadMore() {
    if (loading) return;
    loading = true;
    const params = new URLSearchParams({ limit: BATCH, offset });
    if (garden) params.set('garden', garden);
    params.set('type', type);
    const batch = await fetch(`/api/observations?${params}`)
      .then(r => r.json()).catch(() => []);
    const items = batch.filter(o => o.filename || type === 'notiz');
    items.forEach(o => {
      if (fotosLoaded === 0 && sectionId) {
        document.getElementById(sectionId)?.removeAttribute('hidden');
      }
      sharedList?.push(o);
      sentinel.before(buildObsCard(o, gardenMap, plantMap, sharedList ?? items, colorMap));
      fotosLoaded++;
    });
    offset += batch.length;
    batches++;
    loading = false;
    onLoad?.();
    const done = batch.length < BATCH || (maxBatches && batches >= maxBatches);
    if (done) {
      sentinel.remove();
      observer.disconnect();
      if (fotosLoaded === 0 && sectionId) {
        document.getElementById(sectionId)?.setAttribute('hidden', '');
      }
      if (showAllHref) {
        const link = document.createElement('a');
        link.className = 'carousel-card carousel-show-all';
        link.href = `${showAllHref}?from=${fotosLoaded}`;
        link.textContent = 'Alle Beobachtungen →';
        carousel.appendChild(link);
      }
    }
  }

  sentinel.style.minWidth = '1px';

  const observer = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting) loadMore(); },
    { root: carousel, threshold: 0 }
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

let _gridObserver = null;
let _gridGeneration = 0;

// Paginated masonry grid (2 cols mobile / 6 desktop) for the Beobachtungen
// page — the type tabs each have hundreds of observations, so this fetches
// in batches as the user scrolls instead of loading everything up front.
// Call again (with a new type) to switch tabs; disconnects the previous
// observer and rebuilds the columns. Returns a controller for prepending/
// updating/removing cards in place, and jumping to a known index.
export function initLazyObsGrid(containerId, { gardenMap, plantMap, colorMap = null, garden = null, type = 'foto' }) {
  const container = document.getElementById(containerId);
  if (!container) return { list: [], prepend() {}, update() {}, remove() {}, scrollToIndex() {} };

  _gridObserver?.disconnect();
  container.innerHTML = '';
  const myGeneration = ++_gridGeneration;

  const BATCH = 24;
  let offset = 0;
  let loading = false;
  let done = false;
  let colIndex = 0;
  const list = [];

  const numCols = window.matchMedia('(max-width: 640px)').matches ? 2 : 6;
  const cols = Array.from({ length: numCols }, () => {
    const col = document.createElement('div');
    col.className = 'obs-col';
    container.appendChild(col);
    return col;
  });

  // Siblings *after* the grid, not children of it — .obs-grid's flex:1
  // columns assume exactly numCols children, and nesting these inside a
  // column would mean later-appended cards land after them, burying the
  // sentinel mid-content instead of keeping it at the true end.
  const emptyMsg = document.createElement('div');
  emptyMsg.hidden = true;
  emptyMsg.textContent = 'Keine Beobachtungen';
  container.insertAdjacentElement('afterend', emptyMsg);

  const sentinel = document.createElement('div');
  sentinel.style.minHeight = '1px';
  emptyMsg.insertAdjacentElement('afterend', sentinel);

  function addCard(o, toStart = false) {
    const card = buildObsCard(o, gardenMap, plantMap, list, colorMap);
    const col = cols[colIndex % cols.length];
    toStart ? col.prepend(card) : col.appendChild(card);
    colIndex++;
    emptyMsg.hidden = true;
  }

  async function loadMore() {
    if (loading || done) return null;
    loading = true;
    const params = new URLSearchParams({ limit: BATCH, offset, type });
    if (garden) params.set('garden', garden);
    const batch = await fetch(`/api/observations?${params}`).then(r => r.json()).catch(() => []);
    if (myGeneration !== _gridGeneration) return null; // a newer grid replaced this one while we were fetching
    batch.forEach(o => { list.push(o); addCard(o); });
    offset += batch.length;
    loading = false;
    if (batch.length < BATCH) {
      done = true;
      sentinel.remove();
      _gridObserver?.disconnect();
      if (list.length === 0) emptyMsg.hidden = false;
    }
    return batch;
  }

  _gridObserver = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting) loadMore(); },
    { root: null, rootMargin: '0px 0px 800px 0px', threshold: 0 }
  );
  _gridObserver.observe(sentinel);
  loadMore();

  return {
    list,
    prepend(o) { list.unshift(o); addCard(o, true); },
    update(o) {
      const idx = list.findIndex(x => x.id === o.id);
      if (idx !== -1) list[idx] = o;
      container.querySelector(`[data-obs-id="${o.id}"]`)?.replaceWith(buildObsCard(o, gardenMap, plantMap, list, colorMap));
    },
    remove(id) {
      const idx = list.findIndex(x => x.id === id);
      if (idx !== -1) list.splice(idx, 1);
      container.querySelectorAll(`[data-obs-id="${id}"]`).forEach(el => el.remove());
    },
    // Keep loading batches until we've reached the target index (or run out).
    async scrollToIndex(index) {
      while (list.length <= index && !done) await loadMore();
      const el = container.querySelector(`[data-obs-id="${list[index]?.id}"]`);
      el?.scrollIntoView({ behavior: 'instant', block: 'start' });
    },
  };
}
