import { supabase, authedFetch } from './auth.js';

const btn      = document.getElementById('topbar-btn');
const dropdown = document.getElementById('topbar-dropdown');

let _user    = null;
let _profile = null;

supabase.auth.getSession().then(({ data: { session } }) => {
  _user = session?.user ?? null;
  if (_user) loadProfile();
});

supabase.auth.onAuthStateChange((_e, session) => {
  _user = session?.user ?? null;
  if (_user) loadProfile();
  else { _profile = null; if (!dropdown.hidden) renderDropdown(); }
});

async function loadProfile() {
  const r = await authedFetch('/api/profiles/me');
  if (r.ok) { _profile = await r.json(); if (!dropdown.hidden) renderDropdown(); }
}

btn.addEventListener('click', e => {
  e.stopPropagation();
  dropdown.hidden = !dropdown.hidden;
  if (!dropdown.hidden) renderDropdown();
});

document.addEventListener('click', () => { dropdown.hidden = true; });
dropdown.addEventListener('click', e => e.stopPropagation());

function renderDropdown() {
  if (_user) {
    const name = _profile?.username ?? _user.email ?? '';
    dropdown.innerHTML = `
      <div class="topbar-dd-info">${name}</div>
      <button class="topbar-dd-item" id="dd-rename">Name ändern</button>
      <button class="topbar-dd-item" id="dd-logout">Abmelden</button>
    `;
    dropdown.querySelector('#dd-rename').addEventListener('click', () => {
      const next = prompt('Neuer Name:', _profile?.username ?? '');
      if (!next?.trim()) return;
      authedFetch('/api/profiles/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: next.trim() }),
      }).then(r => {
        if (r.ok) { _profile = { ..._profile, username: next.trim() }; renderDropdown(); }
      });
    });
    dropdown.querySelector('#dd-logout').addEventListener('click', () => {
      supabase.auth.signOut();
      dropdown.hidden = true;
    });
  } else {
    dropdown.innerHTML = `
      <form id="dd-login-form" class="topbar-dd-login">
        <input class="topbar-dd-input" type="email" placeholder="Email" required autocomplete="email">
        <button class="topbar-dd-item" type="submit">Magic Link senden</button>
      </form>
    `;
    dropdown.querySelector('#dd-login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email = e.target.querySelector('input').value;
      if (email !== 'k.birkenbach@gmail.com') {
        dropdown.innerHTML = `<div class="topbar-dd-info">Link an ${email} verschickt.</div>`;
        return;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      dropdown.innerHTML = error
        ? `<div class="topbar-dd-info">Fehler: ${error.message}</div>`
        : `<div class="topbar-dd-info">Link an ${email} verschickt.</div>`;
    });
  }
}
