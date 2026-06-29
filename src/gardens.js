export function renderGardenList(gardens, observations = []) {
  const plantsByGarden = new Map();
  observations.forEach(o => {
    if (o.garden && o.slugs?.length) {
      if (!plantsByGarden.has(o.garden)) plantsByGarden.set(o.garden, new Set());
      o.slugs.forEach(s => plantsByGarden.get(o.garden).add(s));
    }
  });
  const list = document.getElementById('garden-list');
  gardens.forEach(g => {
    const li  = document.createElement('li');
    const a   = document.createElement('a');
    a.href    = '/' + (g.path ?? g.id);
    const n   = plantsByGarden.get(g.id)?.size ?? 0;
    a.textContent = g.name;
    const count = document.createElement('span');
    count.className = 'garden-count';
    count.textContent = ` [${n} Pflanzen]`;
    li.appendChild(a);
    li.appendChild(count);
    list.appendChild(li);
  });
}
