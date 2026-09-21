function trimmed(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function validHttpUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function getPublicSupabaseConfig(env = {}) {
  const url = validHttpUrl(trimmed(env.VITE_SUPABASE_URL));
  const anonKey = trimmed(env.VITE_SUPABASE_ANON_KEY);
  const enabled = Boolean(url && anonKey);

  return {
    enabled,
    url: enabled ? url : null,
    anonKey: enabled ? anonKey : null,
  };
}
