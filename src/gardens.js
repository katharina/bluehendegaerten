export function renderGardenList(gardens, observations = []) {
  const plantsByGarden = new Map();

  observations.forEach(o => {
    if (!o.garden || !o.slugs?.length) return;
    if (!plantsByGarden.has(o.garden)) plantsByGarden.set(o.garden, new Set());
    o.slugs.forEach(s => plantsByGarden.get(o.garden).add(s));
  });

  const list = document.getElementById('garden-list');
  gardens.forEach(g => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href   = '/' + (g.path ?? g.id);
    a.textContent = g.name;

    const plantCount = document.createElement('span');
    plantCount.className = 'garden-count';
    plantCount.textContent = ` [${plantsByGarden.get(g.id)?.size ?? 0} Pflanzen]`;

    li.appendChild(a);
    li.appendChild(plantCount);
    list.appendChild(li);
  });
}
