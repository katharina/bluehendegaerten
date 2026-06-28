import { fullUrl } from './utils.js';

let _dialog, _ctx, _list = [], _index = 0;

export function initObsModal({ gardens = [], plants = [] } = {}) {
  _ctx = {
    gardenMap: new Map(gardens.map(g => [g.id, g])),
    plantMap:  new Map(plants.map(p => [p.slug, p])),
  };

  _dialog = document.getElementById('obs-modal');
  _dialog.addEventListener('click', () => _dialog.close());
  _dialog.addEventListener('close', () => {
    const img = _dialog.querySelector('.obs-modal-img img');
    img.onload = img.onerror = null;
    img.src = '';
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
  });

  document.addEventListener('obs:open', e => {
    const detail = e.detail;
    if (detail.list) {
      _list  = detail.list;
      _index = _list.indexOf(detail.obs);
      if (_index === -1) _index = 0;
    } else {
      _list  = [detail];
      _index = 0;
    }
    renderObs(_list[_index], () => {
      if (!_dialog.open) {
        _dialog.showModal();
        _dialog.focus();
      }
      updateNav();
    });
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

function renderObs(obs, onReady) {
  const { gardenMap, plantMap } = _ctx;

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

  const date   = obs.date
    ? new Date(obs.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const garden = gardenMap.get(obs.garden);
  const place  = obs.place || garden?.name || '';

  _dialog.querySelector('.obs-modal-date').textContent  = date;
  _dialog.querySelector('.obs-modal-place').textContent = place;

  const plantsEl = _dialog.querySelector('.obs-modal-plants');
  plantsEl.innerHTML = (obs.slugs ?? [])
    .map(s => plantMap.get(s))
    .filter(Boolean)
    .map(p => `<span class="obs-modal-plant-link botanical-name" data-slug="${p.slug}">${p.name}</span>`)
    .join('');

  plantsEl.querySelectorAll('.obs-modal-plant-link').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      _dialog.close();
      document.dispatchEvent(new CustomEvent('plant:open', { detail: plantMap.get(el.dataset.slug) }));
    });
  });

  const noteEl = _dialog.querySelector('.obs-modal-note');
  noteEl.textContent = obs.text ?? '';
  noteEl.hidden = !obs.text;
}
