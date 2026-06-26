import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  const { data, error } = await supabase.from('gardens').select('id, name');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, gardens: data });
}
