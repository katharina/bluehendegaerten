import { supabase } from './supabase.js';

export async function getUser(req) {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  return error ? null : user;
}

export async function requireUser(req, res) {
  const user = await getUser(req);
  if (!user) { res.status(401).json({ error: 'Unauthenticated' }); return null; }
  return user;
}
