import { fullUrl, contrastColor } from './utils.js';
import { supabase } from './auth.js';
import { getCurrentUserId } from './observations.js';

let _dialog, _ctx, _list = [], _index = 0, _showAllHref = null;
let _loggedIn = false;
const isMobile = () => window.matchMedia('(max-width: 640px)').matches;

export function initObsModal({ gardens = [], plants = [], showAllHref = null } = {}) {
  _showAllHref = showAllHref;
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
    document.body.style.overflow = '';
    const img = _dialog.querySelector('.obs-modal-img img');
    img.onload = img.onerror = null;
    img.src = '';
    _dialog.querySelector('.obs-modal-list').innerHTML = '';
    hideAllScreen();
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

    renderObs(_list[_index], () => {
      if (!_dialog.open) { document.body.style.overflow = 'hidden'; _dialog.showModal(); _dialog.focus(); }
      updateNav();
    });
  });
}

function navigate(dir) {
  const next = _index + dir;
  if (next < 0) return;
  if (next >= _list.length) {
    if (_showAllHref) showAllScreen();
    return;
  }
  hideAllScreen();
  _index = next;
  renderObs(_list[_index], updateNav);
}

function updateNav() {
  const multi = _list.length > 1;
  _dialog.querySelector('.obs-nav--prev').hidden = !multi || _index === 0;
  _dialog.querySelector('.obs-nav--next').hidden = !multi;
}

function showAllScreen() {
  const inner = _dialog.querySelector('.obs-modal-inner');
  inner.hidden = true;
  _dialog.querySelector('.obs-nav--prev').hidden = false;
  _dialog.querySelector('.obs-nav--next').hidden = true;

  let end = _dialog.querySelector('.obs-modal-end');
  if (!end) {
    end = document.createElement('div');
    end.className = 'obs-modal-end';
    end.addEventListener('click', e => e.stopPropagation());
    _dialog.insertBefore(end, _dialog.querySelector('.obs-modal-list'));
  }
  const sep  = _showAllHref.includes('?') ? '&' : '?';
  const href = `${_showAllHref}${sep}from=${_list.length}`;
  end.innerHTML = `<a class="obs-modal-end-link" href="${href}">Alle Beobachtungen →</a>`;
  end.hidden = false;
}

function hideAllScreen() {
  const end = _dialog.querySelector('.obs-modal-end');
  if (end) end.hidden = true;
  _dialog.querySelector('.obs-modal-inner').hidden = false;
}

function buildObsInfo(obs) {
  const { gardenMap, plantMap } = _ctx;
  const date   = obs.date
    ? new Date(obs.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const garden     = gardenMap.get(obs.garden);
  const gardenPath = garden ? `/${garden.path ?? garden.id}` : null;
  const place      = garden ? garden.name : (obs.place || '');
  const plantNames = (obs.slugs ?? []).map(s => plantMap.get(s)).filter(Boolean);
  const mapUrl = obs.lat != null ? `https://www.openstreetmap.org/?mlat=${obs.lat}&mlon=${obs.lon}&zoom=16` : null;
  return { date, place, gardenPath, garden, plantNames, mapUrl };
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
  listEl.scrollTop = 0;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'obs-list-close action-btn-icon';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', e => { e.stopPropagation(); _dialog.close(); });
  listEl.appendChild(closeBtn);

  list.forEach((obs, i) => {
    const { date, place, gardenPath, garden, plantNames, mapUrl } = buildObsInfo(obs);
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
        ${place ? `<div class="observation-place">${gardenPath ? `<a class="obs-modal-garden-link" href="${gardenPath}">${place}</a>` : place}</div>` : ''}
        ${date   ? `<div class="observation-date">${date}</div>` : ''}
        ${obs.created_by && obs.created_by !== getCurrentUserId() ? `<div class="carousel-card-creator">${obs.created_by_name || 'Blümchen'}</div>` : ''}
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

    item.addEventListener('click', e => e.stopPropagation());
    listEl.appendChild(item);

    if (obs.lat != null && !obs.place) {
      fetch('/api/geocode-obs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: obs.id, lat: obs.lat, lon: obs.lon }),
      }).then(r => r.json()).then(({ place: p }) => {
        if (p) {
          obs.place = p;
          const placeEl = item.querySelector('.observation-place');
          if (placeEl) {
            placeEl.textContent = p;
          } else {
            const span = document.createElement('div');
            span.className = 'observation-place';
            span.textContent = p;
            const dateEl = item.querySelector('.observation-date');
            dateEl ? item.querySelector('.obs-list-meta').insertBefore(span, dateEl) : item.querySelector('.obs-list-meta').prepend(span);
          }
        }
      }).catch(() => {});
    }
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
  imgWrap.classList.remove('info-overlap');
  const plantColor = (obs.slugs ?? []).map(s => _ctx.plantMap.get(s)?.color).find(Boolean) ?? null;
  if (obs.filename) {
    img.style.opacity = '0';
    imgWrap.style.background = plantColor ?? '#444';
    img.onload = () => {
      img.onload = null;
      img.style.opacity = '';
      imgWrap.style.background = '';
      if (isMobile()) {
        const infoEl = imgWrap.querySelector('.obs-modal-info');
        const overflows = img.offsetHeight + (infoEl?.offsetHeight ?? 0) > window.innerHeight;
        imgWrap.classList.toggle('info-overlap', overflows);
      }
      onReady?.();
    };
    img.onerror = () => { img.onerror = null; img.style.opacity = ''; imgWrap.style.background = ''; onReady?.(); };
    img.src = fullUrl(obs.filename);
    imgWrap.hidden = false;
  } else {
    imgWrap.hidden = true;
    onReady?.();
  }

  const { date, place, gardenPath, plantNames, mapUrl } = buildObsInfo(obs);

  _dialog.querySelector('.obs-modal-date').textContent = date;
  const placeEl = _dialog.querySelector('.obs-modal-place');
  if (gardenPath) {
    placeEl.innerHTML = `<a class="obs-modal-garden-link" href="${gardenPath}">${place}</a>`;
    placeEl.querySelector('a').addEventListener('click', e => e.stopPropagation());
  } else {
    placeEl.textContent = place;
  }

  if (obs.lat != null && !obs.place) {
    fetch('/api/geocode-obs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: obs.id, lat: obs.lat, lon: obs.lon }),
    }).then(r => r.json()).then(({ place: p }) => {
      if (p) {
        obs.place = p;
        if (!gardenPath) placeEl.textContent = p;
      }
    }).catch(() => {});
  }

  const plantsEl = _dialog.querySelector('.obs-modal-plants');
  plantsEl.innerHTML = plantNames
    .map(p => `<span class="obs-modal-plant-link botanical-name" data-slug="${p.slug}">${p.name}</span>`)
    .join('');
  plantsEl.querySelectorAll('.obs-modal-plant-link').forEach(el => {
    const plant = _ctx.plantMap.get(el.dataset.slug);
    if (plant?.color) {
      el.style.background = plant.color;
      el.style.color = contrastColor(plant.color);
    }
    el.addEventListener('click', e => {
      e.stopPropagation();
      _dialog.close();
      document.dispatchEvent(new CustomEvent('plant:open', { detail: plant }));
    });
  });

  const noteEl = _dialog.querySelector('.obs-modal-note');
  noteEl.textContent = obs.text ?? '';
  noteEl.hidden = !obs.text;

}
