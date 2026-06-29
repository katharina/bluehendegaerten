import { fullUrl } from './utils.js';
import { supabase } from './auth.js';

let _dialog, _ctx, _list = [], _index = 0;
let _loggedIn = false;
const isMobile = () => window.matchMedia('(max-width: 640px)').matches;

export function initObsModal({ gardens = [], plants = [] } = {}) {
  _ctx = {
    gardenMap: new Map(gardens.map(g => [g.id, g])),
    plantMap:  new Map(plants.map(p => [p.slug, p])),
  };

  _dialog = document.getElementById('obs-modal');

  supabase.auth.getSession().then(({ data: { session } }) => { _loggedIn = !!session?.user; });
  supabase.auth.onAuthStateChange((_, session) => { _loggedIn = !!session?.user; });

  _dialog.addEventListener('click', e => {
    if (isMobile()) { _dialog.close(); return; }
    _dialog.close();
  });
  _dialog.addEventListener('close', () => {
    const img = _dialog.querySelector('.obs-modal-img img');
    img.onload = img.onerror = null;
    img.src = '';
    _dialog.querySelector('.obs-modal-list').innerHTML = '';
  });

  _dialog.querySelector('.obs-nav--prev').addEventListener('click', e => {
    e.stopPropagation();
    navigate(-1);
  });
  _dialog.querySelector('.obs-nav--next').addEventListener('click', e => {
    e.stopPropagation();
    navigate(1);
  });

  _dialog.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); navigate(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
    if (e.key === 'Escape')     { _dialog.close(); }
  });

  document.addEventListener('obs:open', e => {
    const detail = e.detail;
    if (detail.list) {
      _list  = detail.list;
      _index = _list.indexOf(detail.obs);
      if (_index === -1) _index = 0;
    } else {
      _list  = [detail.obs ?? detail];
      _index = 0;
    }

    if (isMobile()) {
      renderList(_list, _index);
    } else {
      renderObs(_list[_index], () => {
        if (!_dialog.open) { _dialog.showModal(); _dialog.focus(); }
        updateNav();
      });
    }
  });
}

function navigate(dir) {
  _index = (_index + dir + _list.length) % _list.length;
  renderObs(_list[_index], updateNav);
}

function updateNav() {
  const show = _list.length > 1;
  _dialog.querySelector('.obs-nav--prev').hidden = !show;
  _dialog.querySelector('.obs-nav--next').hidden = !show;
}

function buildObsInfo(obs) {
  const { gardenMap, plantMap } = _ctx;
  const date   = obs.date
    ? new Date(obs.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const garden     = gardenMap.get(obs.garden);
  const place      = obs.place || garden?.name || '';
  const gardenPath = garden ? `/${garden.path ?? garden.id}` : null;
  const plantNames = (obs.slugs ?? []).map(s => plantMap.get(s)).filter(Boolean);
  return { date, place, gardenPath, garden, plantNames };
}

function renderList(list, startIndex) {
  const listEl = _dialog.querySelector('.obs-modal-list');
  const inner  = _dialog.querySelector('.obs-modal-inner');
  const prevBtn = _dialog.querySelector('.obs-nav--prev');
  const nextBtn = _dialog.querySelector('.obs-nav--next');

  inner.hidden  = true;
  prevBtn.hidden = true;
  nextBtn.hidden = true;
  listEl.hidden  = false;
  listEl.innerHTML = '';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'obs-list-close action-btn-icon';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', e => { e.stopPropagation(); _dialog.close(); });
  listEl.appendChild(closeBtn);

  list.forEach((obs, i) => {
    const { date, place, gardenPath, garden, plantNames } = buildObsInfo(obs);
    const item = document.createElement('div');
    item.className = 'obs-list-item';
    item.dataset.index = i;

    const plantLinks = plantNames
      .map(p => `<span class="obs-modal-plant-link botanical-name" data-slug="${p.slug}">${p.name}</span>`)
      .join('');

    item.innerHTML = `
      ${obs.filename ? `<div class="obs-list-img-wrap"><img class="obs-list-img" src="${fullUrl(obs.filename)}" loading="lazy"></div>` : ''}
      <div class="obs-list-meta">
        ${plantLinks ? `<div class="obs-list-plants">${plantLinks}</div>` : ''}
        ${place ? `<div class="observation-place">${gardenPath && !obs.place ? `<a class="obs-modal-garden-link" href="${gardenPath}">${place}</a>` : place}</div>` : ''}
        ${date  ? `<div class="observation-date">${date}</div>` : ''}
        ${obs.text ? `<div class="obs-list-note">${obs.text}</div>` : ''}
      </div>`;

    item.querySelectorAll('.obs-modal-plant-link').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        _dialog.close();
        document.dispatchEvent(new CustomEvent('plant:open', { detail: _ctx.plantMap.get(el.dataset.slug) }));
      });
    });
    item.querySelector('.obs-modal-garden-link')?.addEventListener('click', e => e.stopPropagation());

    const imgEl = item.querySelector('.obs-list-img');
    const wrap  = item.querySelector('.obs-list-img-wrap');
    if (imgEl && wrap) {
      imgEl.addEventListener('load', () => {
        if (imgEl.naturalWidth > imgEl.naturalHeight) wrap.classList.add('is-landscape');
      });
    }

    item.addEventListener('click', e => e.stopPropagation());
    listEl.appendChild(item);
  });

  if (!_dialog.open) { _dialog.showModal(); _dialog.focus(); }

  requestAnimationFrame(() => {
    // +1 because closeBtn is children[0]
    const target = listEl.children[startIndex + 1];
    target?.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
}

function renderObs(obs, onReady) {
  const listEl = _dialog.querySelector('.obs-modal-list');
  const inner  = _dialog.querySelector('.obs-modal-inner');
  listEl.hidden  = true;
  inner.hidden   = false;

  const imgWrap = _dialog.querySelector('.obs-modal-img');
  const img     = _dialog.querySelector('.obs-modal-img img');
  if (obs.filename) {
    img.onload = () => { img.onload = null; onReady?.(); };
    img.onerror = () => { img.onerror = null; onReady?.(); };
    img.src = fullUrl(obs.filename);
    imgWrap.hidden = false;
  } else {
    imgWrap.hidden = true;
    onReady?.();
  }

  const { date, place, gardenPath, plantNames } = buildObsInfo(obs);

  _dialog.querySelector('.obs-modal-date').textContent = date;
  const placeEl = _dialog.querySelector('.obs-modal-place');
  if (gardenPath && !obs.place) {
    placeEl.innerHTML = `<a class="obs-modal-garden-link" href="${gardenPath}">${place}</a>`;
    placeEl.querySelector('a').addEventListener('click', e => e.stopPropagation());
  } else {
    placeEl.textContent = place;
  }

  const plantsEl = _dialog.querySelector('.obs-modal-plants');
  plantsEl.innerHTML = plantNames
    .map(p => `<span class="obs-modal-plant-link botanical-name" data-slug="${p.slug}">${p.name}</span>`)
    .join('');
  plantsEl.querySelectorAll('.obs-modal-plant-link').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      _dialog.close();
      document.dispatchEvent(new CustomEvent('plant:open', { detail: _ctx.plantMap.get(el.dataset.slug) }));
    });
  });

  const noteEl = _dialog.querySelector('.obs-modal-note');
  noteEl.textContent = obs.text ?? '';
  noteEl.hidden = !obs.text;
}
