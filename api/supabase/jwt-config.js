function unavailable() {
  const error = new Error('supabase-jwt-config-unavailable')
  error.code = 'supabase-jwt-config-unavailable'
  return error
}

function required(value) {
  if (typeof value !== 'string' || !value.trim()) throw unavailable()
  return value.trim()
}

export function readSupabaseJwtConfig(env = {}) {
  return {
    privateKey: required(env.FPP_SUPABASE_JWT_PRIVATE_KEY),
    keyId: required(env.FPP_SUPABASE_JWT_KEY_ID),
    ttlSeconds: 300,
    renewalWindowSeconds: 30,
  }
}
