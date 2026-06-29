import { authedFetch, supabase } from './auth.js';

let _dialog, _formInner, _loginPane, _gardens, _plantBySlug, _plantByScientific;
let _defaultGardenId = null;
let _editId = null;
let _lat = null, _lon = null;
let _suggestions = [];
let _currentPlantSlug = null;
let _loggedIn = false;
let _recentSlugs = [];

export function initObsForm({ gardens = [], plants = [], gardenId = null, observations = [] } = {}) {
  _dialog = document.getElementById('obs-form-dialog');
  if (!_dialog) return;
  _formInner = _dialog.querySelector('.obs-form-inner');

  _gardens = gardens;
  _defaultGardenId = gardenId;

  _plantBySlug = new Map(plants.map(p => [p.slug, p]));
  _plantByScientific = new Map();
  for (const p of plants) {
    _plantByScientific.set(p.name.toLowerCase(), p.slug);
    const genus = p.name.split(' ')[0].toLowerCase();
    if (!_plantByScientific.has(genus)) _plantByScientific.set(genus, p.slug);
  }

  const seen = new Set();
  _recentSlugs = [];
  for (const o of [...observations].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    for (const slug of (o.slugs ?? [])) {
      if (!seen.has(slug)) { seen.add(slug); _recentSlugs.push(slug); }
    }
  }

  supabase.auth.getSession().then(({ data: { session } }) => { _loggedIn = !!session?.user; });
  supabase.auth.onAuthStateChange((_, session) => { _loggedIn = !!session?.user; });

  _dialog.addEventListener('click', e => { if (e.target === _dialog) _close(); });
  _dialog.querySelector('#obs-form-close').addEventListener('click', _close);
  _dialog.querySelector('#obs-form-cancel').addEventListener('click', _close);
  _dialog.querySelector('#obs-form-file').addEventListener('change', _onFileChange);
  _dialog.querySelector('#obs-form-camera').addEventListener('change', _onFileChange);
  _dialog.querySelector('#obs-form-submit').addEventListener('click', _onSubmit);

  document.getElementById('quick-obs-btn')?.addEventListener('click', () => openObsForm({}));
  document.addEventListener('obs:new',  e => openObsForm(e.detail ?? {}));
  document.addEventListener('obs:edit', e => openObsForm({ editObs: e.detail }));
}

export function openObsForm({ plantSlug = null, gardenId = null, editObs = null } = {}) {
  if (!_loggedIn) { _showLoginForm(); return; }
  if (_loginPane) _loginPane.hidden = true;
  _formInner.hidden = false;
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
  if (editObs?.filename) {
    fileLabel.querySelector('#obs-form-file-text').textContent = editObs.filename.split('/').pop();
    fileLabel.classList.add('has-file');
  } else {
    fileLabel.querySelector('#obs-form-file-text').textContent = 'Bild auswählen…';
    fileLabel.classList.remove('has-file');
  }

  const gardenSelect = _dialog.querySelector('#obs-form-garden');
  gardenSelect.innerHTML =
    '<option value="">— kein Garten —</option>' +
    _gardens.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  gardenSelect.value = editObs?.garden ?? gardenId ?? _defaultGardenId ?? '';

  const preselected = editObs?.slugs ?? (plantSlug ? [plantSlug] : []);
  _buildIdentifiedSection(_suggestions);
  _buildPlantGrid(preselected, _suggestions);

  _dialog.showModal();
  _dialog.focus();
}

function _close() {
  _editId = null;
  _suggestions = [];
  _dialog.close();
}

function _showLoginForm() {
  if (!_loginPane) {
    _loginPane = document.createElement('div');
    _loginPane.className = 'obs-form-inner';
    _dialog.appendChild(_loginPane);
  }
  _loginPane.innerHTML = `
    <div class="section-header obs-form-inner-header">
      <h2 class="obs-form-title">Anmelden</h2>
    </div>
    <div class="obs-form-field">
      <label class="obs-form-label">E-Mail</label>
      <input id="obs-login-email" class="obs-input" type="email" autocomplete="email" placeholder="email@beispiel.de">
    </div>
    <div id="obs-login-msg" class="obs-form-msg"></div>
    <div class="obs-form-actions">
      <button id="obs-login-submit" class="action-btn">Magic Link senden</button>
      <button id="obs-login-cancel" class="action-btn-ghost">Abbrechen</button>
    </div>`;
  _loginPane.querySelector('#obs-login-cancel').addEventListener('click', _close);
  _loginPane.querySelector('#obs-login-submit').addEventListener('click', async () => {
    const email = _loginPane.querySelector('#obs-login-email').value.trim();
    if (!email) return;
    const btn = _loginPane.querySelector('#obs-login-submit');
    btn.disabled = true;
    btn.textContent = '…';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    const msg = _loginPane.querySelector('#obs-login-msg');
    if (error) {
      msg.textContent = 'Fehler: ' + error.message;
      btn.disabled = false;
      btn.textContent = 'Magic Link senden';
    } else {
      msg.textContent = `Link an ${email} verschickt.`;
      btn.hidden = true;
    }
  });
  _formInner.hidden = true;
  _loginPane.hidden = false;
  _dialog.showModal();
  _dialog.focus();
  setTimeout(() => _loginPane.querySelector('#obs-login-email')?.focus(), 50);
}

function _plantNetToSlug(name) {
  const lower = name.toLowerCase();
  return _plantByScientific.get(lower) ?? _plantByScientific.get(lower.split(' ')[0]) ?? null;
}

function _inferColor(name, family) {
  const genus = name.split(' ')[0].toLowerCase();
  for (const p of _plantBySlug.values()) {
    if (p.color && p.name.toLowerCase().startsWith(genus + ' ')) return p.color;
  }
  if (family) {
    for (const p of _plantBySlug.values()) {
      if (p.color && p.family?.toLowerCase() === family.toLowerCase()) return p.color;
    }
  }
  return null;
}

function makeChip(p, checked, score, suggested) {
  const chip = document.createElement('label');
  chip.className = 'obs-plant-chip' + (checked ? ' checked' : '') + (suggested ? ' pn-suggested' : '');
  chip.innerHTML = `
    <input type="checkbox" value="${p.slug}"${checked ? ' checked' : ''}>
    <span class="chip-dot"></span>
    <em class="chip-botanical">${p.name}</em>
    ${p.name_de ? `<span class="chip-de">${p.name_de}</span>` : ''}
    ${score != null ? `<span class="pn-score">${score}%</span>` : ''}
    <button type="button" class="chip-remove">×</button>`;
  if (p.color) chip.querySelector('.chip-dot').style.background = p.color;
  chip.querySelector('input').addEventListener('change', e => chip.classList.toggle('checked', e.target.checked));
  chip.querySelector('.chip-remove').addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    chip.remove();
  });
  return chip;
}

function _buildIdentifiedSection(suggestions) {
  const section = _dialog.querySelector('#obs-form-identified');
  section.innerHTML = '';
  const matched   = suggestions.filter(s => s.slug);
  const unmatched = suggestions.filter(s => !s.slug);
  if (!matched.length && !unmatched.length) { section.hidden = true; return; }

  if (matched.length) {
    const hdr = document.createElement('div');
    hdr.className = 'obs-plant-grid-header';
    hdr.textContent = 'Identifizierte Pflanzen';
    section.appendChild(hdr);
    matched.forEach(s => {
      const p = _plantBySlug.get(s.slug);
      if (p) section.appendChild(makeChip({ ...p, name_de: p.name_de || s.common || null }, true, s.score, true));
    });
  }
  if (unmatched.length) {
    const hdr2 = document.createElement('div');
    hdr2.className = 'obs-plant-grid-header';
    hdr2.textContent = 'Neu identifiziert';
    section.appendChild(hdr2);
    unmatched.forEach(s => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'obs-plant-chip pn-new-plant';
      btn.innerHTML = `+ <em>${s.name}</em>${s.common ? `<span class="chip-de">${s.common}</span>` : ''}<span class="pn-score">${s.score}%</span>`;
      btn.title = 'Als neue Pflanze hinzufügen';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Wird hinzugefügt…';
        const grid = _dialog.querySelector('#obs-form-plant-grid');
        const current = [
          ...[...section.querySelectorAll('input:checked')].map(i => i.value),
          ...[...grid.querySelectorAll('input:checked')].map(i => i.value),
        ];
        await _addPlantFromPlantNet(s, suggestions, current);
      });
      section.appendChild(btn);
    });
  }
  section.hidden = false;
}

function _buildPlantGrid(preselected = [], suggestions = []) {
  const grid = _dialog.querySelector('#obs-form-plant-grid');
  grid.innerHTML = '';

  const matched        = suggestions.filter(s => s.slug);
  const suggestedSlugs = matched.map(s => s.slug);
  const scoreMap       = new Map(matched.map(s => [s.slug, s.score]));

  // 1. Filter input — always at top
  const filterWrap = document.createElement('div');
  filterWrap.className = 'obs-add-plant-wrap';
  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.className = 'filter-input';
  filterInput.placeholder = 'Pflanzen filtern…';
  filterInput.autocomplete = 'off';
  filterInput.spellcheck = false;
  filterWrap.appendChild(filterInput);
  grid.appendChild(filterWrap);

  // 2. Pre-selected chips (from edit or plant-modal open)
  preselected.forEach(slug => {
    const p = _plantBySlug.get(slug);
    if (p) grid.appendChild(makeChip(p, true, scoreMap.get(slug), suggestedSlugs.includes(slug)));
  });

  // 3. All plants sorted by recent use — 5 visible by default, filter shows all
  const shown = new Set([...preselected, ...suggestedSlugs]);
  const sorted = [..._plantBySlug.values()]
    .filter(p => !shown.has(p.slug))
    .sort((a, b) => {
      const ai = _recentSlugs.indexOf(a.slug);
      const bi = _recentSlugs.indexOf(b.slug);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return (a.name_de || a.name).localeCompare(b.name_de || b.name);
    });

  const chips = sorted.map(p => {
    const chip = makeChip(p, false, null, false);
    grid.appendChild(chip);
    return { chip, p };
  });

  filterInput.addEventListener('input', () => {
    const q = filterInput.value.toLowerCase();
    chips.forEach(({ chip, p }) => {
      chip.hidden = !!q && !p.name.toLowerCase().includes(q) && !(p.name_de || '').toLowerCase().includes(q);
    });
  });
}

async function _addPlantFromPlantNet(suggestion, allSuggestions, currentPreselected) {
  const slug  = suggestion.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const color = _inferColor(suggestion.name, suggestion.family);
  const garden = _dialog.querySelector('#obs-form-garden').value || null;
  try {
    const res  = await authedFetch('/api/custom-plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, name: suggestion.name, name_de: suggestion.common ?? null, family: suggestion.family ?? null, garden, ...(color && { color }) }),
    });
    const body = await res.json();
    if (!res.ok && body.error !== 'slug already exists') { alert(body.error); return; }
    const finalSlug = body.slug ?? slug;
    _plantBySlug.set(finalSlug, { slug: finalSlug, name: suggestion.name, name_de: suggestion.common ?? null, family: suggestion.family ?? null, ...(color && { color }) });
    _plantByScientific.set(suggestion.name.toLowerCase(), finalSlug);
    const genus = suggestion.name.split(' ')[0].toLowerCase();
    if (!_plantByScientific.has(genus)) _plantByScientific.set(genus, finalSlug);
    const updated = allSuggestions.map(s => s.name === suggestion.name ? { ...s, slug: finalSlug } : s);
    _suggestions = updated;
    _buildIdentifiedSection(updated);
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
      .map(r => ({ name: r.name, score: r.score, family: r.family ?? null, common: r.common ?? null, slug: _plantNetToSlug(r.name) }))
      .filter(s => s.score >= 10)
      .filter(s => { const key = s.slug ?? s.name; if (seen.has(key)) return false; seen.add(key); return true; });
    const preselected = [...grid.querySelectorAll('input:checked')].map(i => i.value);
    _suggestions = suggestions;
    _buildIdentifiedSection(suggestions);
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
  const isCam = e.target.id === 'obs-form-camera';
  const label = _dialog.querySelector(isCam ? '#obs-form-camera-label' : '#obs-form-file-label');
  const span  = label.querySelector('span');
  span.textContent = file ? file.name : (isCam ? 'Kamera' : 'Hochladen');
  label.classList.toggle('has-file', !!file);
  _lat = null; _lon = null;
  if (!file) return;
  try {
    const mod   = await import('exifr');
    const exifr = mod.default ?? mod;
    const [meta, gps] = await Promise.all([
      exifr.parse(file, ['DateTimeOriginal']),
      exifr.gps(file),
    ]);
    if (meta?.DateTimeOriginal)
      _dialog.querySelector('#obs-form-date').value = meta.DateTimeOriginal.toISOString().slice(0, 10);
    if (gps?.latitude != null) { _lat = gps.latitude; _lon = gps.longitude; }
  } catch (err) { console.warn('exifr:', err); }
  _identifyPlant(file);
}

async function _onSubmit() {
  const msg  = _dialog.querySelector('#obs-form-msg');
  const btn  = _dialog.querySelector('#obs-form-submit');
  if (!_loggedIn) { msg.textContent = 'Bitte zuerst einloggen.'; return; }
  const file = _dialog.querySelector('#obs-form-file').files[0]
            ?? _dialog.querySelector('#obs-form-camera').files[0];
  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = '…';

  const slugs = [
    ..._dialog.querySelectorAll('#obs-form-identified input:checked'),
    ..._dialog.querySelectorAll('#obs-form-plant-grid input:checked'),
  ].map(i => i.value).filter((v, i, a) => a.indexOf(v) === i);
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
