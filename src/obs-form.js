import { authedFetch, supabase } from './auth.js';

let _dialog, _gardens, _plantBySlug, _plantByScientific;
let _defaultGardenId = null;
let _editId = null;
let _lat = null, _lon = null;
let _suggestions = [];
let _currentPlantSlug = null;
let _loggedIn = false;

export function initObsForm({ gardens = [], plants = [], gardenId = null } = {}) {
  _dialog = document.getElementById('obs-form-dialog');
  if (!_dialog) return;

  _gardens = gardens;
  _defaultGardenId = gardenId;

  _plantBySlug = new Map(plants.map(p => [p.slug, p]));
  _plantByScientific = new Map();
  for (const p of plants) {
    _plantByScientific.set(p.name.toLowerCase(), p.slug);
    const genus = p.name.split(' ')[0].toLowerCase();
    if (!_plantByScientific.has(genus)) _plantByScientific.set(genus, p.slug);
  }

  supabase.auth.getSession().then(({ data: { session } }) => { _loggedIn = !!session?.user; });
  supabase.auth.onAuthStateChange((_, session) => { _loggedIn = !!session?.user; });

  _dialog.addEventListener('click', e => { if (e.target === _dialog) _close(); });
  _dialog.querySelector('#obs-form-close').addEventListener('click', _close);
  _dialog.querySelector('#obs-form-cancel').addEventListener('click', _close);
  _dialog.querySelector('#obs-form-file').addEventListener('change', _onFileChange);
  _dialog.querySelector('#obs-form-submit').addEventListener('click', _onSubmit);

  document.getElementById('quick-obs-btn')?.addEventListener('click', () => openObsForm({}));
  document.addEventListener('obs:new', e => openObsForm(e.detail ?? {}));
}

export function openObsForm({ plantSlug = null, gardenId = null, editObs = null } = {}) {
  _editId = editObs?.id ?? null;
  _lat    = editObs?.lat ?? null;
  _lon    = editObs?.lon ?? null;
  _suggestions = editObs?.plantnet_suggestions ? JSON.parse(editObs.plantnet_suggestions) : [];
  _currentPlantSlug = plantSlug;

  _dialog.querySelector('#obs-form-title').textContent = _editId ? 'Bearbeiten' : 'Beobachtung';
  _dialog.querySelector('#obs-form-date').value  = editObs?.date ?? new Date().toISOString().slice(0, 10);
  _dialog.querySelector('#obs-form-type').value  = editObs?.type ?? 'foto';
  _dialog.querySelector('#obs-form-text').value  = editObs?.text ?? '';
  _dialog.querySelector('#obs-form-msg').textContent = '';

  const fileInput = _dialog.querySelector('#obs-form-file');
  const fileLabel = _dialog.querySelector('#obs-form-file-label');
  fileInput.value = '';
  fileLabel.querySelector('#obs-form-file-text').textContent = 'Bild auswählen…';
  fileLabel.classList.remove('has-file');

  const gardenSelect = _dialog.querySelector('#obs-form-garden');
  gardenSelect.innerHTML =
    '<option value="">— kein Garten —</option>' +
    _gardens.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  gardenSelect.value = editObs?.garden ?? gardenId ?? _defaultGardenId ?? '';

  const preselected = editObs?.slugs ?? (plantSlug ? [plantSlug] : []);
  _buildPlantGrid(preselected, _suggestions);

  _dialog.showModal();
  _dialog.focus();
}

function _close() {
  _editId = null;
  _suggestions = [];
  _dialog.close();
}

function _plantNetToSlug(name) {
  const lower = name.toLowerCase();
  return _plantByScientific.get(lower) ?? _plantByScientific.get(lower.split(' ')[0]) ?? null;
}

function _buildPlantGrid(preselected = [], suggestions = [], showAll = false) {
  const grid = _dialog.querySelector('#obs-form-plant-grid');
  grid.innerHTML = '';

  const matched       = suggestions.filter(s => s.slug);
  const unmatched     = suggestions.filter(s => !s.slug);
  const suggestedSlugs = matched.map(s => s.slug);
  const scoreMap      = new Map(matched.map(s => [s.slug, s.score]));

  function makeChip(p, checked, score, suggested) {
    const chip = document.createElement('label');
    chip.className = 'obs-plant-chip' + (checked ? ' checked' : '') + (suggested ? ' pn-suggested' : '');
    chip.innerHTML = `
      <input type="checkbox" value="${p.slug}"${checked ? ' checked' : ''}>
      <em class="chip-botanical">${p.name}</em>
      ${p.name_de ? `<span class="chip-de">${p.name_de}</span>` : ''}
      ${score != null ? `<span class="pn-score">${score}%</span>` : ''}
      <button type="button" class="chip-remove">×</button>`;
    chip.querySelector('input').addEventListener('change', e => chip.classList.toggle('checked', e.target.checked));
    chip.querySelector('.chip-remove').addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      chip.remove();
    });
    return chip;
  }

  preselected.forEach(slug => {
    const p = _plantBySlug.get(slug);
    if (p) grid.appendChild(makeChip(p, true, scoreMap.get(slug), suggestedSlugs.includes(slug)));
  });

  if (showAll) {
    [..._plantBySlug.values()]
      .filter(p => !preselected.includes(p.slug))
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(p => grid.appendChild(makeChip(p, false, null, false)));
  } else if (suggestions.length && !preselected.length) {
    const hdr = document.createElement('div');
    hdr.className = 'obs-plant-grid-header';
    hdr.textContent = 'Identifizierte Pflanzen';
    grid.appendChild(hdr);
    suggestedSlugs.forEach(slug => {
      const p = _plantBySlug.get(slug);
      if (p) grid.appendChild(makeChip(p, true, scoreMap.get(slug), true));
    });
    unmatched.forEach(s => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'obs-plant-chip pn-new-plant';
      btn.innerHTML = `+ <em>${s.name}</em><span class="pn-score">${s.score}%</span>`;
      btn.title = 'Als neue Pflanze hinzufügen';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Wird hinzugefügt…';
        const current = [...grid.querySelectorAll('input:checked')].map(i => i.value);
        await _addPlantFromPlantNet(s, suggestions, current);
      });
      grid.appendChild(btn);
    });
  }

  if (!showAll) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'obs-add-plant-btn';
    addBtn.textContent = '+ Pflanze hinzufügen';
    addBtn.addEventListener('click', () => {
      const current = [...grid.querySelectorAll('input:checked')].map(i => i.value);
      _buildPlantGrid(current, suggestions, true);
    });
    grid.appendChild(addBtn);
  }
}

async function _addPlantFromPlantNet(suggestion, allSuggestions, currentPreselected) {
  const slug = suggestion.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const garden = _dialog.querySelector('#obs-form-garden').value || null;
  try {
    const res  = await authedFetch('/api/custom-plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, name: suggestion.name, family: suggestion.family ?? null, garden }),
    });
    const body = await res.json();
    if (!res.ok && body.error !== 'slug already exists') { alert(body.error); return; }
    const finalSlug = body.slug ?? slug;
    _plantBySlug.set(finalSlug, { slug: finalSlug, name: suggestion.name, family: suggestion.family ?? null });
    _plantByScientific.set(suggestion.name.toLowerCase(), finalSlug);
    const genus = suggestion.name.split(' ')[0].toLowerCase();
    if (!_plantByScientific.has(genus)) _plantByScientific.set(genus, finalSlug);
    const updated = allSuggestions.map(s => s.name === suggestion.name ? { ...s, slug: finalSlug } : s);
    _buildPlantGrid([...currentPreselected, finalSlug], updated);
  } catch (e) { alert('Fehler: ' + e.message); }
}

async function _resizeToDataUrl(file, maxPx = 800) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else       { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function _identifyPlant(file) {
  const grid = _dialog.querySelector('#obs-form-plant-grid');
  const placeholder = document.createElement('span');
  placeholder.className = 'obs-plant-chip pn-identifying';
  placeholder.textContent = 'Erkenne…';
  grid.prepend(placeholder);
  try {
    const dataUrl = await _resizeToDataUrl(file);
    if (!dataUrl) { placeholder.remove(); return; }
    const data = await authedFetch('/api/plantnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    }).then(r => r.json());
    const seen = new Set();
    const suggestions = (data.results ?? [])
      .map(r => ({ name: r.name, score: r.score, family: r.family ?? null, slug: _plantNetToSlug(r.name) }))
      .filter(s => s.score >= 10)
      .filter(s => { const key = s.slug ?? s.name; if (seen.has(key)) return false; seen.add(key); return true; });
    const preselected = [...grid.querySelectorAll('input:checked')].map(i => i.value);
    _suggestions = suggestions;
    _buildPlantGrid(preselected, suggestions);
  } catch { placeholder.remove(); }
}

async function _uploadToR2(file) {
  const contentType = file.type || 'image/jpeg';
  const urlRes = await authedFetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType, filename: file.name }),
  });
  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}));
    throw new Error(err.error ?? `upload-url ${urlRes.status}`);
  }
  const { url, key } = await urlRes.json();
  const putRes = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': contentType } });
  if (!putRes.ok) throw new Error(`R2 PUT ${putRes.status}`);
  // Pre-generate thumbnail so it's cached in R2 before the page reloads
  fetch(`/api/thumb/${encodeURIComponent(key)}`).catch(() => {});
  return key;
}

async function _onFileChange(e) {
  const file = e.target.files[0];
  const label = _dialog.querySelector('#obs-form-file-label');
  label.querySelector('#obs-form-file-text').textContent = file?.name ?? 'Bild auswählen…';
  label.classList.toggle('has-file', !!file);
  _lat = null; _lon = null;
  if (!file) return;
  try {
    const exifr = await import('exifr');
    const [meta, gps] = await Promise.all([
      exifr.parse(file, ['DateTimeOriginal']),
      exifr.gps(file),
    ]);
    if (meta?.DateTimeOriginal)
      _dialog.querySelector('#obs-form-date').value = meta.DateTimeOriginal.toISOString().slice(0, 10);
    if (gps?.latitude != null) { _lat = gps.latitude; _lon = gps.longitude; }
  } catch {}
  _identifyPlant(file);
}

async function _onSubmit() {
  const msg  = _dialog.querySelector('#obs-form-msg');
  const btn  = _dialog.querySelector('#obs-form-submit');
  if (!_loggedIn) { msg.textContent = 'Bitte zuerst einloggen.'; return; }
  const file = _dialog.querySelector('#obs-form-file').files[0];
  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = '…';

  const slugs = [..._dialog.querySelectorAll('#obs-form-plant-grid input:checked')].map(i => i.value);
  let filename = null;

  try {
    if (file) filename = await _uploadToR2(file);

    const body = {
      date:   _dialog.querySelector('#obs-form-date').value || null,
      type:   _dialog.querySelector('#obs-form-type').value,
      garden: _dialog.querySelector('#obs-form-garden').value || null,
      text:   _dialog.querySelector('#obs-form-text').value || null,
      slugs,
      ...(_lat != null && { lat: _lat, lon: _lon }),
      ...(filename     && { filename }),
    };

    if (_editId) {
      await authedFetch(`/api/observations/${_editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      await authedFetch('/api/observations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }

    _dialog.close();
    window.location.reload();
  } catch (e) {
    msg.textContent = 'Fehler: ' + (e.message ?? 'unbekannt');
    btn.disabled = false;
    btn.textContent = 'Speichern';
  }
}
