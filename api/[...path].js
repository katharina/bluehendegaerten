import { supabase } from '../lib/supabase.js';
import { getUser, requireUser } from '../lib/auth.js';
import { logEdits } from '../lib/logEdit.js';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2 } from '../lib/r2.js';
import { R2_BUCKET, R2_PUBLIC_URL } from '../lib/config.js';

const PLANT_INFO_FIELDS = ['art','wuchs','hoehe','breite','frost','wurzel','licht','boden','wasser','naehrstoff','ph','kuebel','bloom_months','invasiv'];
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']);

async function withSlugs(rows) {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const { data: links } = await supabase
    .from('observation_plants').select('observation_id, slug').in('observation_id', ids);
  return rows.map(r => ({
    ...r,
    slugs: (links ?? []).filter(l => l.observation_id === r.id).map(l => l.slug),
  }));
}

export default async function handler(req, res) {
  const pathname = new URL(req.url, 'http://x').pathname;
  const segments = pathname.replace(/^\/api\//, '').replace(/^\//, '').split('/').filter(Boolean);
  const [resource, id] = segments;

  // ── Health ──────────────────────────────────────────────────────────────────
  if (resource === 'health') {
    const { data, error } = await supabase.from('gardens').select('id, name');
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true, gardens: data });
  }

  // ── Upload URL ──────────────────────────────────────────────────────────────
  if (resource === 'upload-url') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
    if (!await requireUser(req, res)) return;
    const { contentType, filename } = req.body ?? {};
    if (!contentType || !ALLOWED_UPLOAD_TYPES.has(contentType))
      return res.status(400).json({ error: 'invalid content type' });
    const ext = filename?.split('.').pop()?.toLowerCase() ?? 'jpg';
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const url = await getSignedUrl(r2,
      new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn: 300 });
    return res.json({ url, key });
  }

  // ── Thumbnail (generate on first request, cache in R2) ──────────────────────
  if (resource === 'thumb') {
    const key = decodeURIComponent(segments.slice(1).join('/'));
    if (!key) return res.status(400).end();
    const thumbKey = key.replace(/\.[^.]+$/, '_thumb.jpg');
    const fetchR2 = async (k) => {
      const r = await fetch(`${R2_PUBLIC_URL}/${k}`);
      if (!r.ok) throw new Error(`R2 ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    };
    if (!req.query.regen) {
      try {
        const cached = await fetchR2(thumbKey);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(cached);
      } catch {}
    }
    try {
      const original = await fetchR2(key);
      const { default: sharp } = await import('sharp');
      const thumb = await sharp(original)
        .rotate()
        .resize({ width: 400, height: 600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: thumbKey, Body: thumb, ContentType: 'image/jpeg' })).catch(() => {});
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(thumb);
    } catch {
      return res.status(404).end();
    }
  }

  // ── PlantNet identification ──────────────────────────────────────────────────
  if (resource === 'plantnet') {
    if (req.method !== 'POST') return res.status(405).end();
    if (!await requireUser(req, res)) return;
    const apiKey = process.env.PLANTNET_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'not configured' });
    const { dataUrl } = req.body ?? {};
    if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });
    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
    const buf = Buffer.from(base64, 'base64');
    const form = new FormData();
    form.append('images', new Blob([buf], { type: 'image/jpeg' }), 'image.jpg');
    form.append('organs', 'auto');
    try {
      const r = await fetch(
        `https://my-api.plantnet.org/v2/identify/all?api-key=${apiKey}&lang=de&include-related-images=false`,
        { method: 'POST', body: form }
      );
      if (!r.ok) return res.status(r.status).json({ error: 'plantnet error' });
      const data = await r.json();
      const results = (data.results ?? []).slice(0, 5).map(item => ({
        name: item.species.scientificNameWithoutAuthor,
        score: Math.round(item.score * 100),
        common: item.species.commonNames?.[0] ?? null,
        family: item.species.family?.scientificNameWithoutAuthor ?? null,
      }));
      return res.json({ results });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Gardens ─────────────────────────────────────────────────────────────────
  if (resource === 'gardens') {
    if (!id) {
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
        const { id: gid, path, name, description, plants, is_private, has_plan } = req.body ?? {};
        if (!gid || !path || !name) return res.status(400).json({ error: 'missing fields' });
        const { error } = await supabase.from('gardens').insert({
          id: gid, path, name, description: description ?? null,
          plants: plants ?? [], created_by: user.id,
          is_private: is_private ?? false, has_plan: has_plan ?? false,
        });
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
      }
    } else {
      if (req.method === 'GET') {
        const user = await getUser(req);
        const { data, error } = await supabase.from('gardens').select('*').eq('id', id).maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ error: 'not found' });
        if (data.is_private && data.created_by !== user?.id)
          return res.status(403).json({ error: 'forbidden' });
        return res.json(data);
      }
      if (req.method === 'PATCH') {
        const user = await requireUser(req, res);
        if (!user) return;
        const { data: g } = await supabase.from('gardens').select('created_by').eq('id', id).maybeSingle();
        if (g?.created_by !== user.id) return res.status(403).json({ error: 'forbidden' });
        const { name, description, plants, is_private } = req.body ?? {};
        const fields = {};
        if (name        !== undefined) fields.name        = name;
        if (description !== undefined) fields.description = description;
        if (plants      !== undefined) fields.plants      = plants;
        if (is_private  !== undefined) fields.is_private  = is_private;
        const { error } = await supabase.from('gardens').update(fields).eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        const user = await requireUser(req, res);
        if (!user) return;
        const { data: g } = await supabase.from('gardens').select('created_by').eq('id', id).maybeSingle();
        if (g?.created_by !== user.id) return res.status(403).json({ error: 'forbidden' });
        const { error } = await supabase.from('gardens').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
      }
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  // ── Observations ─────────────────────────────────────────────────────────────
  if (resource === 'observations') {
    if (!id) {
      if (req.method === 'GET') {
        const { slug, garden } = req.query;
        let rows;
        if (slug) {
          const { data: links } = await supabase
            .from('observation_plants').select('observation_id').eq('slug', slug);
          const ids = (links ?? []).map(l => l.observation_id);
          if (!ids.length) return res.json([]);
          const { data, error } = await supabase
            .from('observations').select('*').in('id', ids).order('id', { ascending: false });
          if (error) return res.status(500).json({ error: error.message });
          rows = data;
        } else {
          let query = supabase.from('observations').select('*').order('id', { ascending: false });
          if (garden) query = query.eq('garden', garden);
          const { data, error } = await query;
          if (error) return res.status(500).json({ error: error.message });
          rows = data;
        }
        return res.json(await withSlugs(rows));
      }
      if (req.method === 'POST') {
        if (!await requireUser(req, res)) return;
        const { date, type = 'foto', text, filename, lat, lon, slugs = [] } = req.body ?? {};
        const garden = req.body?.garden || 'betonbeete';
        const { data: obs, error } = await supabase
          .from('observations')
          .insert({ garden, date: date || null, type, text: text || null, filename: filename || null, lat: lat ?? null, lon: lon ?? null })
          .select().single();
        if (error) return res.status(500).json({ error: error.message });
        if (slugs.length)
          await supabase.from('observation_plants').insert(slugs.map(s => ({ observation_id: obs.id, slug: s })));
        return res.json({ ...obs, slugs });
      }
    } else {
      if (req.method === 'PATCH') {
        if (!await requireUser(req, res)) return;
        const { date, type, text, filename, lat, lon, place, plantnet_suggestions, slugs } = req.body ?? {};
        const fields = {};
        if (date                  !== undefined) fields.date                  = date || null;
        if (type                  !== undefined) fields.type                  = type;
        if (text                  !== undefined) fields.text                  = text || null;
        if (filename              !== undefined) fields.filename              = filename || null;
        if (lat                   !== undefined) fields.lat                   = lat ?? null;
        if (lon                   !== undefined) fields.lon                   = lon ?? null;
        if (place                 !== undefined) fields.place                 = place || null;
        if (plantnet_suggestions  !== undefined) fields.plantnet_suggestions  = plantnet_suggestions ?? null;
        if (Object.keys(fields).length) {
          const { error } = await supabase.from('observations').update(fields).eq('id', id);
          if (error) return res.status(500).json({ error: error.message });
        }
        if (slugs !== undefined) {
          await supabase.from('observation_plants').delete().eq('observation_id', id);
          if (slugs.length)
            await supabase.from('observation_plants').insert(slugs.map(s => ({ observation_id: Number(id), slug: s })));
        }
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        if (!await requireUser(req, res)) return;
        const { error } = await supabase.from('observations').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
      }
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  // ── Plant info ───────────────────────────────────────────────────────────────
  if (resource === 'plant-info') {
    if (id === 'all') {
      const { data, error } = await supabase.from('plant_info').select('*');
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data ?? []);
    }
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('plant_info').select('*').eq('slug', id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data ?? { slug: id });
    }
    if (req.method === 'PATCH' || req.method === 'PUT') {
      const user = await requireUser(req, res);
      if (!user) return;
      const fields = {};
      for (const [k, v] of Object.entries(req.body ?? {}))
        if (PLANT_INFO_FIELDS.includes(k)) fields[k] = v ?? null;
      if (!Object.keys(fields).length) return res.status(400).json({ error: 'nothing to update' });
      const { data: current } = await supabase.from('plant_info').select('*').eq('slug', id).maybeSingle();
      fields.slug = id;
      fields.updated_at = new Date().toISOString();
      const { error } = await supabase.from('plant_info').upsert(fields);
      if (error) return res.status(500).json({ error: error.message });
      await logEdits(id, user.id,
        Object.keys(fields).filter(k => PLANT_INFO_FIELDS.includes(k))
          .map(k => ({ field: k, oldValue: current?.[k] ?? null, newValue: fields[k] })));
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  // ── Plans ────────────────────────────────────────────────────────────────────
  if (resource === 'plans') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('plans').select('data').eq('id', id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ data: data?.data ?? null });
    }
    if (req.method === 'PUT') {
      if (!await requireUser(req, res)) return;
      const { data: body } = req.body ?? {};
      if (!body) return res.status(400).json({ error: 'missing data' });
      const { error } = await supabase.from('plans')
        .upsert({ id, data: body, updated_at: new Date().toISOString() });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  // ── Custom plants ─────────────────────────────────────────────────────────────
  if (resource === 'custom-plants') {
    if (!id) {
      if (req.method === 'GET') {
        const { garden } = req.query;
        let query = supabase.from('custom_plants').select('*').order('name');
        if (garden) query = query.eq('garden', garden);
        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
      }
      if (req.method === 'POST') {
        if (!await requireUser(req, res)) return;
        const { slug, name, name_de, family, color, world_w, world_h, garden = 'betonbeete' } = req.body ?? {};
        if (!slug || !name) return res.status(400).json({ error: 'slug and name required' });
        const { data, error } = await supabase.from('custom_plants')
          .insert({ slug, name, name_de: name_de || null, family: family || null,
                    color: color || null, world_w: parseFloat(world_w) || 0.5,
                    world_h: parseFloat(world_h) || 1.0, garden })
          .select().single();
        if (error?.code === '23505') return res.status(409).json({ error: 'slug already exists' });
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
      }
    } else {
      if (req.method === 'PATCH') {
        const user = await requireUser(req, res);
        if (!user) return;
        const { name, name_de, family, color, world_w, world_h } = req.body ?? {};
        const fields = {};
        if (name    !== undefined) fields.name    = name;
        if (name_de !== undefined) fields.name_de = name_de;
        if (family  !== undefined) fields.family  = family;
        if (color   !== undefined) fields.color   = color;
        if (world_w !== undefined) fields.world_w = parseFloat(world_w) || 0.5;
        if (world_h !== undefined) fields.world_h = parseFloat(world_h) || 1.0;
        if (!Object.keys(fields).length) return res.status(400).json({ error: 'nothing to update' });
        const { data: current } = await supabase.from('custom_plants').select('*').eq('slug', id).maybeSingle();
        const { error } = await supabase.from('custom_plants').update(fields).eq('slug', id);
        if (error) return res.status(500).json({ error: error.message });
        await logEdits(id, user.id,
          Object.keys(fields).map(k => ({ field: k, oldValue: current?.[k] ?? null, newValue: fields[k] })));
        return res.json({ ok: true });
      }
      if (req.method === 'DELETE') {
        if (!await requireUser(req, res)) return;
        const { error } = await supabase.from('custom_plants').delete().eq('slug', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
      }
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  // ── Bed images ────────────────────────────────────────────────────────────────
  if (resource === 'bed-images') {
    if (!id) {
      if (req.method === 'GET') {
        const { garden = 'betonbeete' } = req.query;
        const { data, error } = await supabase.from('bed_images').select('*').eq('garden', garden);
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
      }
      if (req.method === 'POST') {
        if (!await requireUser(req, res)) return;
        const { garden = 'betonbeete', bed_index, filename } = req.body ?? {};
        if (!filename || bed_index === undefined)
          return res.status(400).json({ error: 'filename and bed_index required' });
        const { error } = await supabase.from('bed_images')
          .upsert({ garden, bed_index: parseInt(bed_index), filename }, { onConflict: 'garden,bed_index' });
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true, filename });
      }
    } else {
      if (req.method === 'DELETE') {
        if (!await requireUser(req, res)) return;
        const { error } = await supabase.from('bed_images').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ ok: true });
      }
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  // ── Profiles ──────────────────────────────────────────────────────────────────
  if (resource === 'profiles' && id === 'me') {
    const user = await requireUser(req, res);
    if (!user) return;
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.json(data ?? { id: user.id, username: null });
    }
    if (req.method === 'PATCH') {
      const { username } = req.body ?? {};
      if (!username?.trim()) return res.status(400).json({ error: 'username required' });
      const { error } = await supabase.from('profiles')
        .upsert({ id: user.id, username: username.trim() }, { onConflict: 'id' });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }
    return res.status(405).json({ error: 'method not allowed' });
  }

  res.status(404).json({ error: 'not found', resource, id, segments });
}
