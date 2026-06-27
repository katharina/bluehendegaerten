import { supabase } from '../../lib/supabase.js';
import { getUser, requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const user = await getUser(req);
    let query = supabase.from('gardens').select('*').order('name');
    if (!user) query = query.eq('is_private', false);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data ?? []);
  }

  if (req.method === 'POST') {
    const user = await requireUser(req, res);
    if (!user) return;
    const { id, path, name, description, plants } = req.body ?? {};
    if (!id || !path || !name) return res.status(400).json({ error: 'missing fields' });
    const { error } = await supabase.from('gardens').insert({
      id, path, name, description: description ?? null,
      plants: plants ?? [], created_by: user.id,
    });
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  }

  res.status(405).json({ error: 'method not allowed' });
}
