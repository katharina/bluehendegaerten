import { supabase } from './supabase.js';

export async function logEdits(slug, userId, changes) {
  const rows = changes
    .filter(({ oldValue, newValue }) => oldValue !== newValue)
    .map(({ field, oldValue, newValue }) => ({
      slug, user_id: userId, field,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    }));
  if (!rows.length) return;
  await supabase.from('plant_edits').insert(rows);
}
