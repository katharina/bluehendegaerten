import { supabase } from '../../lib/supabase.js';
import { requireUser } from '../../lib/auth.js';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'PATCH') {
    if (!await requireUser(req, res)) return;
    const { date, type, text, filename, slugs } = req.body ?? {};
    const fields = {};
    if (date     !== undefined) fields.date     = date || null;
    if (type     !== undefined) fields.type     = type;
    if (text     !== undefined) fields.text     = text || null;
    if (filename !== undefined) fields.filename = filename || null;
    if (Object.keys(fields).length) {
      const { error } = await supabase.from('observations').update(fields).eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
    }
    if (slugs !== undefined) {
      await supabase.from('observation_plants').delete().eq('observation_id', id);
      if (slugs.length) {
        const links = slugs.map(s => ({ observation_id: Number(id), slug: s }));
        await supabase.from('observation_plants').insert(links);
      }
    }
    res.json({ ok: true });

  } else if (req.method === 'DELETE') {
    if (!await requireUser(req, res)) return;
    const { error } = await supabase.from('observations').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });

  } else {
    res.status(405).json({ error: 'method not allowed' });
  }
}
