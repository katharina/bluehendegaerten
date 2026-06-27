import { supabase } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

const ALLOWED = ['art','wuchs','hoehe','breite','frost','wurzel','licht','boden','wasser','naehrstoff','ph','kuebel','bloom_months','invasiv'];

export default async function handler(req, res) {
  const { slug } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('plant_info')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? { slug });

  } else if (req.method === 'PATCH' || req.method === 'PUT') {
    if (!await requireUser(req, res)) return;
    const fields = {};
    for (const [k, v] of Object.entries(req.body ?? {})) {
      if (ALLOWED.includes(k)) fields[k] = v ?? null;
    }
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'nothing to update' });
    fields.slug = slug;
    fields.updated_at = new Date().toISOString();
    const { error } = await supabase.from('plant_info').upsert(fields);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
