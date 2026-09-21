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
  const publishableKey = trimmed(env.SUPABASE_PUBLISHABLE_KEY);
  const secretKey = trimmed(env.SUPABASE_SECRET_KEY);
  const enabled = Boolean(url && publishableKey);

  return {
    enabled,
    url: enabled ? url : null,
    publishableKey: enabled ? publishableKey : null,
    secretKey: enabled ? secretKey : null,
    hasServerCredentials: Boolean(enabled && secretKey),
  };
}
