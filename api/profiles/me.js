import { supabase } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? { id: user.id, username: null });

  } else if (req.method === 'PATCH') {
    const { username } = req.body ?? {};
    if (!username?.trim()) return res.status(400).json({ error: 'username required' });
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, username: username.trim() });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
