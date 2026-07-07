import { fullUrl } from './utils.js';

const highlights = await fetch('/api/observations?highlighted=true').then(r => r.json()).catch(() => []);
if (!highlights.length) return;

const obs = highlights[Math.floor(Math.random() * highlights.length)];
const img = document.getElementById('highlight-img');
img.addEventListener('load', () => {
  document.getElementById('highlight-bg').classList.add('is-loaded');
  document.body.classList.add('has-highlight');
}, { once: true });
img.src = fullUrl(obs.filename);
