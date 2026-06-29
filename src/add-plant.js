import { authedFetch } from './auth.js';

function toSlug(name) {
  return name.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

export function initAddPlant({ onAdded } = {}) {
  const dialog = document.getElementById('add-plant-dialog');
  if (!dialog) return;

  const familyInput = document.getElementById('apf-family');
  familyInput.setAttribute('list', 'plant-family-list');
  familyInput.removeAttribute('autocomplete');

  const open = () => {
    document.getElementById('apf-name').value = '';
    document.getElementById('apf-name-de').value = '';
    document.getElementById('apf-family').value = '';
    document.getElementById('apf-color').value = '#a0c878';
    document.getElementById('apf-msg').textContent = '';
    dialog.showModal();
    document.getElementById('apf-name').focus();
  };
  const close = () => dialog.close();

  document.getElementById('add-plant-btn')?.addEventListener('click', open);
  document.getElementById('add-plant-close').addEventListener('click', close);
  document.getElementById('apf-cancel').addEventListener('click', close);
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });

  document.getElementById('apf-submit').addEventListener('click', async () => {
    const name   = document.getElementById('apf-name').value.trim();
    const nameDe = document.getElementById('apf-name-de').value.trim();
    const family = document.getElementById('apf-family').value.trim();
    const color  = document.getElementById('apf-color').value;
    const msg    = document.getElementById('apf-msg');

    if (!name) { msg.textContent = 'Botanischer Name ist erforderlich.'; return; }

    const btn = document.getElementById('apf-submit');
    btn.disabled = true;
    msg.textContent = '';

    const slug = toSlug(name);
    const res = await authedFetch('/api/plants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, name, name_de: nameDe || null, family: family || null, color }),
    });
    const data = await res.json().catch(() => ({}));
    btn.disabled = false;

    if (!res.ok) {
      msg.textContent = data.error ?? 'Fehler beim Hinzufügen.';
      return;
    }

    close();
    onAdded?.({ ...data, slug: data.slug ?? slug, name, name_de: nameDe || null, family: family || null, color });
  });
}
