export function renderGardenList(gardens) {
  const list = document.getElementById('garden-list');
  if (!list) return;
  gardens.forEach(g => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href   = '/' + (g.path ?? g.id);
    a.textContent = g.name;

    const plantCount = document.createElement('span');
    plantCount.className = 'garden-count';
    plantCount.textContent = ` [${g.plants?.length ?? 0} Pflanzen]`;

    li.appendChild(a);
    li.appendChild(plantCount);
    list.appendChild(li);
  });
}
