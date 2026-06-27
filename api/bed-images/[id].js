import { supabase } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'method not allowed' });
  if (!await requireUser(req, res)) return;
  const { error } = await supabase.from('bed_images').delete().eq('id', req.query.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
}
