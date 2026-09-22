import { createPrivateKey } from 'node:crypto'
import { SignJWT } from 'jose'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function failure(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function importPrivateKey(privateKey) {
  try {
    if (typeof privateKey !== 'string' || !privateKey.trim()) throw new Error('missing-private-key')
    let key
    try {
      const parsed = JSON.parse(privateKey)
      if (parsed?.kty !== 'EC' || parsed.crv !== 'P-256' || !parsed.d || (parsed.alg && parsed.alg !== 'ES256')) {
        throw new Error('incompatible-jwk')
      }
      key = createPrivateKey({ key: parsed, format: 'jwk' })
    } catch (error) {
      if (error?.message === 'incompatible-jwk') throw error
      key = createPrivateKey({ key: privateKey, format: 'pem' })
    }
    if (key.type !== 'private' || key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
      throw new Error('incompatible-private-key')
    }
    return key
  } catch {
    throw failure('supabase-jwt-signing-unavailable')
  }
}

export function createSupabaseJwtSigner({ config, now = () => new Date() } = {}) {
  if (!config?.privateKey || !config?.keyId || config.ttlSeconds !== 300 || config.renewalWindowSeconds !== 30) {
    throw failure('supabase-jwt-config-unavailable')
  }

  const privateKey = importPrivateKey(config.privateKey)

  const signForUser = async ({ supabaseUserId } = {}) => {
    if (typeof supabaseUserId !== 'string' || !UUID.test(supabaseUserId)) throw failure('supabase-jwt-invalid-subject')
    const normalizedSupabaseUserId = supabaseUserId.toLowerCase()

    const issuedAt = now()
    if (!(issuedAt instanceof Date) || Number.isNaN(issuedAt.getTime())) throw failure('supabase-jwt-signing-unavailable')
    const expiresAt = new Date(issuedAt.getTime() + (config.ttlSeconds * 1000))

    try {
      const token = await new SignJWT({ sub: normalizedSupabaseUserId, role: 'authenticated' })
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
