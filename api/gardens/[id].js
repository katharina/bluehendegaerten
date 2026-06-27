import { supabase } from '../../lib/supabase.js';
import { getUser, requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const user = await getUser(req);
    const { data, error } = await supabase.from('gardens').select('*').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'not found' });
    if (data.is_private && data.created_by !== user?.id) return res.status(403).json({ error: 'forbidden' });
    return res.json(data);
  }

  if (req.method === 'PATCH') {
    const user = await requireUser(req, res);
    if (!user) return;
    const { data: garden } = await supabase.from('gardens').select('created_by').eq('id', id).maybeSingle();
    if (!garden) return res.status(404).json({ error: 'not found' });
    if (garden.created_by !== user.id) return res.status(403).json({ error: 'forbidden' });
    const allowed = ['name', 'description', 'plants', 'path', 'is_private'];
    const fields = {};
    for (const [k, v] of Object.entries(req.body ?? {})) {
      if (allowed.includes(k)) fields[k] = v;
    }
    const { error } = await supabase.from('gardens').update(fields).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const user = await requireUser(req, res);
    if (!user) return;
    const { data: garden } = await supabase.from('gardens').select('created_by').eq('id', id).maybeSingle();
    if (!garden) return res.status(404).json({ error: 'not found' });
    if (garden.created_by !== user.id) return res.status(403).json({ error: 'forbidden' });
    const { error } = await supabase.from('gardens').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'method not allowed' });
}
