import { fullUrl } from './utils.js';

const highlights = await fetch('/api/observations?highlighted=true').then(r => r.json()).catch(() => []);
if (!highlights.length) return;

const obs = highlights[Math.floor(Math.random() * highlights.length)];
const bg = document.getElementById('highlight-bg');
bg.style.backgroundImage = `url(${fullUrl(obs.filename)})`;
document.body.classList.add('has-highlight');
