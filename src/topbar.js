import { supabase } from './auth.js';

const btn      = document.getElementById('topbar-btn');
const dropdown = document.getElementById('topbar-dropdown');

let _user = null;

supabase.auth.getSession().then(({ data: { session } }) => {
  _user = session?.user ?? null;
});

supabase.auth.onAuthStateChange((_e, session) => {
  _user = session?.user ?? null;
  if (!dropdown.hidden) renderDropdown();
});

btn.addEventListener('click', e => {
  e.stopPropagation();
  dropdown.hidden = !dropdown.hidden;
  if (!dropdown.hidden) renderDropdown();
});

document.addEventListener('click', () => { dropdown.hidden = true; });
dropdown.addEventListener('click', e => e.stopPropagation());

function renderDropdown() {
  const navLinks = `
    <a class="topbar-dd-item" href="/">Startseite</a>
    <a class="topbar-dd-item" href="/beobachtungen/fotos">Alle Beobachtungen</a>
    <a class="topbar-dd-item" href="/plants/all">Alle Pflanzen</a>
  `;
  if (_user) {
    const name = _user.user_metadata?.display_name || _user.email || '';
    dropdown.innerHTML = `
      ${navLinks}
      <div class="topbar-dd-divider"></div>
      <div class="topbar-dd-info">${name}</div>
      <button class="topbar-dd-item" id="dd-rename">Name ändern</button>
      <button class="topbar-dd-item" id="dd-logout">Abmelden</button>
    `;
    dropdown.querySelector('#dd-rename').addEventListener('click', async () => {
      const next = prompt('Anzeigename:', _user.user_metadata?.display_name ?? '');
      if (!next?.trim()) return;
      const { error } = await supabase.auth.updateUser({ data: { display_name: next.trim() } });
      if (!error) renderDropdown();
    });
    dropdown.querySelector('#dd-logout').addEventListener('click', () => {
      supabase.auth.signOut();
      dropdown.hidden = true;
    });
  } else {
    dropdown.innerHTML = `
      ${navLinks}
      <div class="topbar-dd-divider"></div>
      <form id="dd-login-form" class="topbar-dd-login">
        <input class="topbar-dd-input" type="email" placeholder="Email" required autocomplete="email">
        <button class="topbar-dd-item" type="submit">Magic Link senden</button>
      </form>
    `;
    dropdown.querySelector('#dd-login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const email = e.target.querySelector('input').value;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) console.error('signInWithOtp error:', error);
      dropdown.innerHTML = error
        ? `<div class="topbar-dd-info">Fehler: ${error.message || error.error_description || JSON.stringify(error)}</div>`
        : `<div class="topbar-dd-info">Link an ${email} verschickt.</div>`;
    });
  }
}
