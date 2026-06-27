import { supabase } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('plans')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data?.data ?? null });

  } else if (req.method === 'PUT') {
    if (!await requireUser(req, res)) return;
    const { data: body } = req.body ?? {};
    if (!body) return res.status(400).json({ error: 'missing data' });
    const { error } = await supabase
      .from('plans')
      .upsert({ id, data: body, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
