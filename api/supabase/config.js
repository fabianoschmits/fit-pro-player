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

export function readSupabaseConfig(env = {}) {
  const url = validHttpUrl(trimmed(env.SUPABASE_URL));
  const anonKey = trimmed(env.SUPABASE_ANON_KEY);
  const serviceRoleKey = trimmed(env.SUPABASE_SERVICE_ROLE_KEY);
  const enabled = Boolean(url && anonKey);

  return {
    enabled,
    url: enabled ? url : null,
    anonKey: enabled ? anonKey : null,
    serviceRoleKey: enabled ? serviceRoleKey : null,
    hasServerCredentials: Boolean(enabled && serviceRoleKey),
  };
}
