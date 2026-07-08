import { fullUrl } from './utils.js';

const highlights = await fetch('/api/observations?highlighted=true').then(r => r.json()).catch(() => []);
if (!highlights.length) return;

const obs = highlights[Math.floor(Math.random() * highlights.length)];

// Apply plant color immediately from the obs response
if (obs.plant_color) document.getElementById('highlight-bg').style.background = obs.plant_color;

// Populate info box
if (obs.slugs?.length) {
  const plants = await fetch('/api/plants').then(r => r.json()).catch(() => []);
  const plantMap = new Map(plants.map(p => [p.slug, p.name]));
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
const sticky = document.querySelector('.highlight-sticky');
sticky.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
const bg     = document.getElementById('highlight-bg');
const info   = document.getElementById('highlight-info');

// Measure the natural (untransformed) bottom of the header once
let naturalHeaderBottom = header.getBoundingClientRect().bottom;
window.addEventListener('resize', () => {
  header.style.transform = '';
  naturalHeaderBottom = header.getBoundingClientRect().bottom;
}, { passive: true });

window.addEventListener('scroll', () => {
  const pastCover = window.scrollY >= bg.offsetHeight * 0.9;

  if (pastCover) {
    header.style.transform = `translateY(-${naturalHeaderBottom + 20}px)`;
    sticky.classList.add('is-visible');
  } else {
    const infoTop = info.hidden ? Infinity : info.getBoundingClientRect().top;
    const push = Math.max(0, naturalHeaderBottom - infoTop);
    header.style.transform = push > 0 ? `translateY(-${push}px)` : '';
    sticky.classList.remove('is-visible');
  }
}, { passive: true });
