// Snapshots all app data from the running API (localhost:3001 by default) into
// backups/<timestamp>/*.json. Run with the dev server up: `npm run server` first.
const BASE = process.env.BACKUP_API_URL || 'http://localhost:3001';

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = new URL(`../backups/${stamp}/`, import.meta.url);
  const fs = await import('node:fs/promises');
  await fs.mkdir(dir, { recursive: true });

  const write = async (name, data) =>
    fs.writeFile(new URL(name, dir), JSON.stringify(data, null, 2));

  console.log('Fetching gardens, plants, observations, plant-info, custom-plants…');
  const [gardens, plants, observations, plantInfo, customPlants] = await Promise.all([
    getJSON('/api/gardens'),
    getJSON('/api/plants'),
    getJSON('/api/observations'),
    getJSON('/api/plant-info/all'),
    getJSON('/api/custom-plants'),
  ]);
  await write('gardens.json', gardens);
  await write('plants.json', plants);
  await write('observations.json', observations);
  await write('plant-info.json', plantInfo);
  await write('custom-plants.json', customPlants);

  console.log(`Fetching plans + bed-images for ${gardens.length} gardens…`);
  const plans = {};
  const bedImages = {};
  for (const g of gardens) {
    plans[g.id] = await getJSON(`/api/plans/${g.id}`).catch(() => null);
    bedImages[g.id] = await getJSON(`/api/bed-images?garden=${g.id}`).catch(() => []);
  }
  await write('plans.json', plans);
  await write('bed-images.json', bedImages);

  console.log(`Backup written to ${dir.pathname}`);
}

main().catch(e => { console.error(e); process.exit(1); });
