import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const { data, error } = await supabase.from('plant_info').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
}
