const OBS_TYPES = [
  { type: 'foto',          label: 'Fotos' },
  { type: 'herbarbeleg',   label: 'Herbarbelege' },
  { type: 'pflanzenlabel', label: 'Pflanzenlabels' },
  { type: 'notiz',         label: 'Notizen' },
];

export function renderGardenList(gardens, observations = []) {
  const plantsByGarden = new Map();
  const obsByGarden    = new Map();

  observations.forEach(o => {
    if (!o.garden) return;
    if (o.slugs?.length) {
      if (!plantsByGarden.has(o.garden)) plantsByGarden.set(o.garden, new Set());
      o.slugs.forEach(s => plantsByGarden.get(o.garden).add(s));
    }
    if (!obsByGarden.has(o.garden)) obsByGarden.set(o.garden, {});
    const counts = obsByGarden.get(o.garden);
    counts[o.type] = (counts[o.type] ?? 0) + 1;
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

    const counts = obsByGarden.get(g.id) ?? {};
    const typeSpans = OBS_TYPES
      .filter(({ type }) => counts[type])
      .map(({ type, label }) => {
        const s = document.createElement('span');
        s.className = 'garden-obs-count';
        s.textContent = `${counts[type]} ${label}`;
        return s;
      });

    li.appendChild(a);
    li.appendChild(plantCount);
    if (typeSpans.length) {
      const row = document.createElement('div');
      row.className = 'garden-obs-counts';
      typeSpans.forEach(s => row.appendChild(s));
      li.appendChild(row);
    }
    list.appendChild(li);
  });
}
