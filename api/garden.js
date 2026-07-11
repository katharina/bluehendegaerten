// Serves garden.html with per-garden og:title/og:image/og:url injected, since
// crawlers don't execute the client-side SPA JS that would otherwise set these.
export default async function handler(req, res) {
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${host}`;
  const slug = req.url.replace(/^\//, '').split(/[?#]/)[0];

  const [htmlRes, gardensRes] = await Promise.all([
    fetch(`${origin}/garden.html`),
    fetch(`${origin}/api/gardens`),
  ]);
  let html = await htmlRes.text();

  if (gardensRes.ok) {
    const gardens = await gardensRes.json();
    const garden = gardens.find(g => (g.path ?? g.id) === slug);
    if (garden) {
      const title = `Blühende Gärten - ${garden.name}`;
      const image = `${origin}/api/og-image?garden=${encodeURIComponent(garden.path ?? garden.id)}`;
      const url   = `${origin}/${slug}`;
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
        .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${image}$2`)
        .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
    }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}
