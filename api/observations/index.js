import { supabase } from '../../lib/supabase.js';

async function withSlugs(rows) {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const { data: links } = await supabase
    .from('observation_plants')
    .select('observation_id, slug')
    .in('observation_id', ids);
  return rows.map(r => ({
    ...r,
    slugs: (links ?? []).filter(l => l.observation_id === r.id).map(l => l.slug),
  }));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { slug, garden } = req.query;
    let rows;
    if (slug) {
      const { data: links } = await supabase
        .from('observation_plants')
        .select('observation_id')
        .eq('slug', slug);
      const ids = (links ?? []).map(l => l.observation_id);
      if (!ids.length) return res.json([]);
      const { data, error } = await supabase
        .from('observations')
        .select('*')
        .in('id', ids)
        .order('date', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      rows = data;
    } else {
      let query = supabase.from('observations').select('*').order('date', { ascending: false });
      if (garden) query = query.eq('garden', garden);
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      rows = data;
    }
    res.json(await withSlugs(rows));

  } else if (req.method === 'POST') {
    const { garden = 'betonbeete', date, type = 'foto', text, slugs = [] } = req.body ?? {};
    const { data: obs, error } = await supabase
      .from('observations')
      .insert({ garden, date: date || null, type, text: text || null, filename: null })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (slugs.length) {
      const links = slugs.map(s => ({ observation_id: obs.id, slug: s }));
      await supabase.from('observation_plants').insert(links);
    }
    res.json({ ...obs, slugs });

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
