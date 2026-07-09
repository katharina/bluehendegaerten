import { fullUrl } from './utils.js';

const [highlights, gardens] = await Promise.all([
  fetch('/api/observations?highlighted=true').then(r => r.json()).catch(() => []),
  fetch('/api/gardens').then(r => r.json()).catch(() => []),
]);
if (!highlights.length) return;
const gardenMap = new Map(gardens.map(g => [g.id, g.name]));

const obs = highlights[Math.floor(Math.random() * highlights.length)];

// Apply plant color immediately from the obs response
if (obs.plant_color) document.getElementById('highlight-bg').style.background = obs.plant_color;

// Populate info box
if (obs.slugs?.length) {
  const { contrastColor } = await import('./utils.js');
  const plants = await fetch('/api/plants').then(r => r.json()).catch(() => []);
  const plantMap = new Map(plants.map(p => [p.slug, p]));
  const container = document.getElementById('highlight-plants');
  container.innerHTML = obs.slugs.map(s =>
    `<span class="obs-modal-plant-link botanical-name" data-slug="${s}">${plantMap.get(s)?.name ?? s}</span>`
  ).join('');
  container.querySelectorAll('[data-slug]').forEach(el => {
    const plant = plantMap.get(el.dataset.slug);
    if (plant?.color) {
      el.style.background = plant.color;
      el.style.color = contrastColor(plant.color);
    }
    el.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('plant:open', { detail: { slug: el.dataset.slug } }));
    });
  });
}
const place = gardenMap.get(obs.garden) || obs.place || '';
if (place) document.getElementById('highlight-place').textContent = place;
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

function updateSticky() {
  sticky.classList.toggle('is-visible', header.getBoundingClientRect().bottom < 0);
}
window.addEventListener('scroll', updateSticky, { passive: true });
window.visualViewport?.addEventListener('resize', updateSticky);
updateSticky();
