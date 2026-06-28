import { fullUrl } from './utils.js';

let _dialog, _ctx;

export function initObsModal({ gardens = [], plants = [] } = {}) {
  _ctx = {
    gardenMap: new Map(gardens.map(g => [g.id, g])),
    plantMap:  new Map(plants.map(p => [p.slug, p])),
  };

  _dialog = document.getElementById('obs-modal');
  _dialog.addEventListener('click', () => _dialog.close());
  _dialog.addEventListener('close', () => { _dialog.querySelector('.obs-modal-img img').src = ''; });

  document.addEventListener('obs:open', e => openObsModal(e.detail));
}

export function openObsModal(obs) {
  const { gardenMap, plantMap } = _ctx;
  const dialog = _dialog;

  const imgWrap = dialog.querySelector('.obs-modal-img');
  const img     = dialog.querySelector('.obs-modal-img img');
  if (obs.filename) {
    img.src = fullUrl(obs.filename);
    imgWrap.hidden = false;
  } else {
    imgWrap.hidden = true;
  }

  const date  = obs.date
    ? new Date(obs.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const garden = gardenMap.get(obs.garden);
  const place  = obs.place || garden?.name || '';

  dialog.querySelector('.obs-modal-date').textContent  = date;
  dialog.querySelector('.obs-modal-place').textContent = place;

  const plantsEl = dialog.querySelector('.obs-modal-plants');
  plantsEl.innerHTML = (obs.slugs ?? [])
    .map(s => plantMap.get(s))
    .filter(Boolean)
    .map(p => `<span class="obs-modal-plant-link botanical-name" data-slug="${p.slug}">${p.name}</span>`)
    .join('');

  plantsEl.querySelectorAll('.obs-modal-plant-link').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      dialog.close();
      document.dispatchEvent(new CustomEvent('plant:open', { detail: plantMap.get(el.dataset.slug) }));
    });
  });

  const noteEl = dialog.querySelector('.obs-modal-note');
  noteEl.textContent = obs.text ?? '';
  noteEl.hidden = !obs.text;

  dialog.showModal();
  dialog.focus();
}
