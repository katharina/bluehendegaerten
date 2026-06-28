import { thumbUrl, fullUrl, contrastColor } from './utils.js';
import { supabase, authedFetch } from './auth.js';

const MONTHS_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const CARE_FIELDS = [
  { key: 'art',        label: 'Wuchsart' },
  { key: 'wuchs',      label: 'Wuchs' },
  { key: 'hoehe',      label: 'Höhe (cm)' },
  { key: 'breite',     label: 'Breite (cm)' },
  { key: 'licht',      label: 'Licht' },
  { key: 'boden',      label: 'Boden' },
  { key: 'wasser',     label: 'Wasser' },
  { key: 'naehrstoff', label: 'Nährstoff' },
  { key: 'ph',         label: 'pH' },
  { key: 'frost',      label: 'Frosthart' },
  { key: 'wurzel',     label: 'Wurzel' },
  { key: 'kuebel',     label: 'Kübel' },
];

let _dialog, _ctx, _loggedIn = false, _gardenId = null;

export function initPlantModal({ gardens = [], observations = [], gardenId = null } = {}) {
  _ctx = { gardens, observations };
  _gardenId = gardenId;
  _dialog = document.getElementById('plant-modal');

  const onAuth = session => {
    _loggedIn = !!session?.user;
    _dialog.classList.toggle('authenticated', _loggedIn);
  };
  supabase.auth.getSession().then(({ data: { session } }) => onAuth(session));
  supabase.auth.onAuthStateChange((_event, session) => onAuth(session));

  document.getElementById('plant-modal-close').addEventListener('click', () => _dialog.close());
  _dialog.addEventListener('click', e => { if (e.target === _dialog) _dialog.close(); });


  document.addEventListener('plant:open', e => openPlantModal(e.detail, { gardenId: _gardenId }));
}

export async function openPlantModal(plant, { gardenId = null } = {}) {
  const { gardens, observations } = _ctx;
  const dialog = _dialog;

  const setColor = c => {
    dialog.style.setProperty('--plant-color', c);
    dialog.style.setProperty('--plant-fg', contrastColor(c));
    dialog.querySelector('.plant-color-swatch').style.background = c;
    dialog.querySelector('.plant-color-picker').value = c;
  };

  setColor(plant.color ?? '#ffffff');

  dialog.querySelector('.plant-modal-name').textContent = plant.name ?? '';
  dialog.querySelector('.plant-modal-de').textContent = plant.name_de ?? '';
  const familyInput = dialog.querySelector('.plant-modal-family');
  familyInput.value = plant.family ?? '';
  familyInput.readOnly = !_loggedIn;

  const picker = dialog.querySelector('.plant-color-picker');
  picker.disabled = !_loggedIn;
  picker.oninput  = () => setColor(picker.value);
  picker.onchange = () => {
    if (!_loggedIn) return;
    authedFetch(`/api/plant-info/${plant.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: picker.value }),
    });
  };

  const plantGardens = gardens.filter(g => (g.plants ?? []).includes(plant.slug));
  dialog.querySelector('.plant-modal-gardens').innerHTML = plantGardens
    .map(g => `<a class="garden-badge" href="/${g.path ?? g.id}">${g.name}</a>`)
    .join('');

  const plantObs = observations
    .filter(o => o.slugs?.includes(plant.slug))
    .sort((a, b) => new Date(b.date ?? b.created_at) - new Date(a.date ?? a.created_at));
  const obsList = dialog.querySelector('.plant-modal-obs-list');
  const [colA, colB] = obsList.querySelectorAll('.obs-col');
  colA.innerHTML = colB.innerHTML = '';
  let i = 0;

  function appendMasonry(card) {
    (i++ % 2 === 0 ? colA : colB).appendChild(card);
  }

  if (gardenId) {
    const here  = plantObs.filter(o => o.garden === gardenId);
    const other = plantObs.filter(o => o.garden !== gardenId);
    if (here.length)  buildObsGroup('Dieser Garten', here, gardens, plantObs).forEach(appendMasonry);
    if (other.length) buildObsGroup('Andere Gärten', other, gardens, plantObs).forEach(appendMasonry);
  } else {
    plantObs.forEach(o => appendMasonry(buildObsCard(o, gardens, plantObs)));
  }

  const bloomBar = dialog.querySelector('.plant-modal-bloom-bar');
  const infoRows = dialog.querySelector('.plant-modal-info-rows');
  bloomBar.innerHTML = infoRows.innerHTML = '';

  fetch(`/api/plant-info/${plant.slug}`)
    .then(r => r.ok ? r.json() : null)
    .then(info => {
      if (!info) return;

      if (info.color) setColor(info.color);

      const blooms = JSON.parse(info.bloom_months ?? '[]');
      if (_loggedIn || blooms.length) {
        bloomBar.innerHTML = MONTHS_DE.map((m, idx) =>
          `<div class="bloom-cell${blooms.includes(idx + 1) ? ' active' : ''}" data-month="${idx + 1}">${m}</div>`
        ).join('');
        if (_loggedIn) {
          bloomBar.classList.add('bloom-bar--editable');
          bloomBar.querySelectorAll('.bloom-cell').forEach(cell => {
            cell.addEventListener('click', () => cell.classList.toggle('active'));
          });
        }
      }

      if (_loggedIn) {
        infoRows.innerHTML = '';
        for (const f of CARE_FIELDS) {
          const row = document.createElement('div');
          row.className = 'plant-info-row';
          const label = document.createElement('label');
          label.className = 'plant-info-label';
          label.textContent = f.label;
          const input = document.createElement('input');
          input.className = 'plant-info-input';
          input.dataset.field = f.key;
          input.value = info[f.key] ?? '';
          input.placeholder = '—';
          row.append(label, input);
          infoRows.appendChild(row);
        }

        const saveBtn = document.createElement('button');
        saveBtn.className = 'action-btn plant-info-save';
        saveBtn.textContent = 'Speichern';
        saveBtn.addEventListener('click', async () => {
          const fields = {};
          infoRows.querySelectorAll('.plant-info-input').forEach(inp => {
            fields[inp.dataset.field] = inp.value.trim() || null;
          });
          fields.bloom_months = JSON.stringify(
            [...bloomBar.querySelectorAll('.bloom-cell.active')].map(c => parseInt(c.dataset.month))
          );
          saveBtn.disabled = true;
          saveBtn.textContent = '…';
          const r = await authedFetch(`/api/plant-info/${plant.slug}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
          });
          saveBtn.disabled = false;
          saveBtn.textContent = r.ok ? 'Gespeichert ✓' : 'Fehler';
          setTimeout(() => saveBtn.textContent = 'Speichern', 2000);
        });
        infoRows.after(saveBtn);
      } else {
        const rows = CARE_FIELDS.filter(f => info[f.key]);
        if (rows.length) {
          infoRows.innerHTML = rows.map(f =>
            `<div class="plant-info-row">
              <span class="plant-info-label">${f.label}</span>
              <span class="plant-info-value">${info[f.key]}</span>
            </div>`
          ).join('');
        }
      }
    });

  dialog.showModal();
  dialog.focus();
}

function buildObsGroup(title, obs, gardens, list) {
  const heading = document.createElement('div');
  heading.className = 'obs-group-title';
  heading.textContent = title;
  return [heading, ...obs.map(o => buildObsCard(o, gardens, list))];
}

function buildObsCard(o, gardens, list = [o]) {
  const card = document.createElement('div');
  card.className = 'modal-obs-card';
  const place = o.place || gardens.find(g => g.id === o.garden)?.name || '';
  const date  = o.date
    ? new Date(o.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  card.innerHTML = `
    ${o.filename ? `<div class="modal-obs-img"><img src="${thumbUrl(o.filename)}" loading="lazy" data-full="${fullUrl(o.filename)}"></div>` : ''}
    <div class="modal-obs-meta">
      ${place ? `<div class="observation-place">${place}</div>` : ''}
      ${date  ? `<div class="observation-date">${date}</div>`  : ''}
    </div>
  `;
  card.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('obs:open', { detail: { obs: o, list } }));
  });
  return card;
}
