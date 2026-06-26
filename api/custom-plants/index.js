import { supabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { garden } = req.query;
    let query = supabase.from('custom_plants').select('*').order('name');
    if (garden) query = query.eq('garden', garden);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);

  } else if (req.method === 'POST') {
    const { slug, name, name_de, family, color, world_w, world_h, garden = 'betonbeete' } = req.body ?? {};
    if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
    const { data, error } = await supabase
      .from('custom_plants')
      .insert({ slug, name, name_de: name_de || null, family: family || null,
                color: color || null, world_w: parseFloat(world_w) || 0.5,
                world_h: parseFloat(world_h) || 1.0, garden })
      .select()
      .single();
    if (error?.code === '23505') return res.status(409).json({ error: 'slug already exists' });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
