import { supabase } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { garden = 'betonbeete' } = req.query;
    const { data, error } = await supabase
      .from('bed_images')
      .select('*')
      .eq('garden', garden);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);

  } else if (req.method === 'POST') {
    if (!await requireUser(req, res)) return;
    const { garden = 'betonbeete', bed_index, filename } = req.body ?? {};
    if (!filename || bed_index === undefined) return res.status(400).json({ error: 'filename and bed_index required' });
    const { error } = await supabase
      .from('bed_images')
      .upsert({ garden, bed_index: parseInt(bed_index), filename },
               { onConflict: 'garden,bed_index' });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, filename });

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
