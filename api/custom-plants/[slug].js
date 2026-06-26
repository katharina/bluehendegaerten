import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  const { slug } = req.query;

  if (req.method === 'PATCH') {
    const { name, name_de, family, color, world_w, world_h } = req.body ?? {};
    const fields = {};
    if (name    !== undefined) fields.name    = name;
    if (name_de !== undefined) fields.name_de = name_de;
    if (family  !== undefined) fields.family  = family;
    if (color   !== undefined) fields.color   = color;
    if (world_w !== undefined) fields.world_w = parseFloat(world_w) || 0.5;
    if (world_h !== undefined) fields.world_h = parseFloat(world_h) || 1.0;
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'nothing to update' });
    const { error } = await supabase.from('custom_plants').update(fields).eq('slug', slug);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });

  } else if (req.method === 'DELETE') {
    const { error } = await supabase.from('custom_plants').delete().eq('slug', slug);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
