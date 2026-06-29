const R2_URL = __R2_URL__;

export function thumbUrl(filename) {
  return `${R2_URL}/${filename.replace(/\.[^.]+$/, '_thumb.jpg')}`;
}

export function fullUrl(filename) {
  return `${R2_URL}/${filename}`;
}

export function parseCm(val) {
  if (!val) return null;
  const parts = String(val).split('-').map(s => parseFloat(s)).filter(n => !isNaN(n));
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function preventPageZoom() {
  document.addEventListener('touchstart', e => {
    if (e.touches.length > 1 && !e.target.closest('img')) e.preventDefault();
  }, { passive: false });
  let _lastTap = 0;
  document.addEventListener('touchend', e => {
    if (e.target.closest('img')) return;
    const now = Date.now();
    if (now - _lastTap < 300) e.preventDefault();
    _lastTap = now;
  }, { passive: false });
}

export function contrastColor(hex) {
  const c = hex?.replace('#', '') ?? 'ffffff';
  const r = parseInt(c.slice(0,2), 16), g = parseInt(c.slice(2,4), 16), b = parseInt(c.slice(4,6), 16);
  const lum = [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return (0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2]) > 0.179 ? '#000' : '#fff';
}
