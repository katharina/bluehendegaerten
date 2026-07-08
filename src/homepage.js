import { fullUrl } from './utils.js';

const highlights = await fetch('/api/observations?highlighted=true').then(r => r.json()).catch(() => []);
if (!highlights.length) return;

const obs = highlights[Math.floor(Math.random() * highlights.length)];

// Populate info box
if (obs.slugs?.length) {
  const plants = await fetch('/api/plants').then(r => r.json()).catch(() => []);
  const plantMap   = new Map(plants.map(p => [p.slug, p.name]));
  const plantColor = obs.slugs.map(s => plants.find(p => p.slug === s)?.color).find(Boolean);
  if (plantColor) document.getElementById('highlight-bg').style.background = plantColor;
  const container = document.getElementById('highlight-plants');
  container.innerHTML = obs.slugs.map(s =>
    `<span class="obs-modal-plant-link botanical-name" data-slug="${s}">${plantMap.get(s) ?? s}</span>`
  ).join('');
  container.querySelectorAll('[data-slug]').forEach(el => {
    el.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('plant:open', { detail: { slug: el.dataset.slug } }));
    });
  });
}
if (obs.place) document.getElementById('highlight-place').textContent = obs.place;
if (obs.date)  document.getElementById('highlight-date').textContent =
  new Date(obs.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
document.getElementById('highlight-info').hidden = false;

const img = document.getElementById('highlight-img');
img.addEventListener('load', () => {
  document.getElementById('highlight-bg').classList.add('is-loaded');
  document.body.classList.add('has-highlight');
}, { once: true });
img.src = fullUrl(obs.filename);

const header = document.querySelector('.highlight-header');
const bg     = document.getElementById('highlight-bg');
window.addEventListener('scroll', () => {
  header.classList.toggle('is-sticky', window.scrollY > bg.offsetHeight * 0.5);
}, { passive: true });
