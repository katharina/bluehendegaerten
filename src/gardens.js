export function renderGardenList(gardens) {
  const list = document.getElementById('garden-list');
  gardens.forEach(g => {
    const li = document.createElement('li');
    const a  = document.createElement('a');
    a.href        = '/' + (g.path ?? g.id);
    a.textContent = g.name;
    li.appendChild(a);
    list.appendChild(li);
  });
}
