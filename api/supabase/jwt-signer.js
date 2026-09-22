import { SignJWT, importJWK, importPKCS8 } from 'jose'

function failure(code) {
  const error = new Error(code)
  error.code = code
  return error
}

async function importPrivateKey(privateKey) {
  try {
    const parsed = JSON.parse(privateKey)
    return await importJWK(parsed, 'ES256')
  } catch {
    try {
      return await importPKCS8(privateKey, 'ES256')
    } catch {
      throw failure('supabase-jwt-signing-unavailable')
    }
  }
}

export function createSupabaseJwtSigner({ config, now = () => new Date() } = {}) {
  if (!config?.privateKey || !config?.keyId || config.ttlSeconds !== 300 || config.renewalWindowSeconds !== 30) {
    throw failure('supabase-jwt-config-unavailable')
  }

  const privateKey = importPrivateKey(config.privateKey)

  const signForUser = async ({ supabaseUserId } = {}) => {
    if (typeof supabaseUserId !== 'string' || !supabaseUserId) throw failure('supabase-jwt-invalid-subject')

    const issuedAt = now()
    if (!(issuedAt instanceof Date) || Number.isNaN(issuedAt.getTime())) throw failure('supabase-jwt-signing-unavailable')
    const expiresAt = new Date(issuedAt.getTime() + (config.ttlSeconds * 1000))

    try {
      const token = await new SignJWT({ sub: supabaseUserId, role: 'authenticated' })
        .setProtectedHeader({ typ: 'JWT', alg: 'ES256', kid: config.keyId })
        .setExpirationTime(expiresAt)
        .sign(await privateKey)

      return {
        token,
        expiresAt: expiresAt.toISOString(),
        expiresIn: config.ttlSeconds,
      }
    } catch (error) {
      if (error?.code === 'supabase-jwt-signing-unavailable') throw error
      throw failure('supabase-jwt-signing-unavailable')
    }
  }

  return { signForUser }
}
