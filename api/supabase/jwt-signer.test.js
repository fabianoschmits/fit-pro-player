import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, verify } from 'node:crypto'

import { readSupabaseJwtConfig } from './jwt-config.js'
import { createSupabaseJwtSigner } from './jwt-signer.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const NOW = new Date('2025-01-01T00:00:00.000Z')
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const privateKeyJwk = privateKey.export({ format: 'jwk' })
const publicKeyJwk = publicKey.export({ format: 'jwk' })
const { privateKey: wrongCurveKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' })

function decode(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

function config() {
  return readSupabaseJwtConfig({
    FPP_SUPABASE_JWT_PRIVATE_KEY: privateKeyPem,
    FPP_SUPABASE_JWT_KEY_ID: 'fpp-test-key',
  })
}

function configWithPrivateKey(value) {
  return { privateKey: value, keyId: 'fpp-test-key', ttlSeconds: 300, renewalWindowSeconds: 30 }
}

test('JWT configuration fails closed when the private key or kid is absent', () => {
  assert.throws(
    () => readSupabaseJwtConfig({ FPP_SUPABASE_JWT_KEY_ID: 'fpp-test-key' }),
    error => error.code === 'supabase-jwt-config-unavailable',
  )
  assert.throws(
    () => readSupabaseJwtConfig({ FPP_SUPABASE_JWT_PRIVATE_KEY: privateKeyPem }),
    error => error.code === 'supabase-jwt-config-unavailable',
  )
})

test('JWT configuration supplies only the fixed bootstrap lifetimes', () => {
  assert.deepEqual(config(), {
    privateKey: privateKeyPem.trim(),
    keyId: 'fpp-test-key',
    ttlSeconds: 300,
    renewalWindowSeconds: 30,
  })
})

test('signer emits a verifiable ES256 token with only bootstrap claims', async () => {
  const signer = createSupabaseJwtSigner({ config: config(), now: () => NOW })

  const signed = await signer.signForUser({ supabaseUserId: USER_ID })
  const [headerSegment, payloadSegment, signatureSegment] = signed.token.split('.')
  const header = decode(headerSegment)
  const payload = decode(payloadSegment)

  assert.deepEqual(header, { typ: 'JWT', alg: 'ES256', kid: 'fpp-test-key' })
  assert.deepEqual(payload, { sub: USER_ID, role: 'authenticated', exp: 1735689900 })
  assert.equal(
    verify(
      'sha256',
      Buffer.from(`${headerSegment}.${payloadSegment}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(signatureSegment, 'base64url'),
    ),
    true,
  )
  assert.equal(typeof signed.token, 'string')
  assert.equal(signed.expiresAt, '2025-01-01T00:05:00.000Z')
  assert.equal(signed.expiresIn, 300)
})

test('signer accepts valid private JWK material during initialization', async () => {
  const signer = createSupabaseJwtSigner({ config: configWithPrivateKey(JSON.stringify(privateKeyJwk)), now: () => NOW })
  const signed = await signer.signForUser({ supabaseUserId: USER_ID })
  assert.equal(typeof signed.token, 'string')
})

test('signer rejects malformed, public-only, wrong-curve, and wrong-algorithm keys during initialization', () => {
  assert.throws(
    () => createSupabaseJwtSigner({ config: configWithPrivateKey('not-a-key') }),
    error => error.code === 'supabase-jwt-signing-unavailable',
  )
  assert.throws(
    () => createSupabaseJwtSigner({ config: configWithPrivateKey(JSON.stringify(publicKeyJwk)) }),
    error => error.code === 'supabase-jwt-signing-unavailable',
  )
  assert.throws(
    () => createSupabaseJwtSigner({ config: configWithPrivateKey(JSON.stringify(wrongCurveKey.export({ format: 'jwk' }))) }),
    error => error.code === 'supabase-jwt-signing-unavailable',
  )
  assert.throws(
    () => createSupabaseJwtSigner({ config: configWithPrivateKey(JSON.stringify({ ...privateKeyJwk, alg: 'RS256' })) }),
    error => error.code === 'supabase-jwt-signing-unavailable',
  )
})

test('signer rejects non-UUID subjects before signing', async () => {
  const signer = createSupabaseJwtSigner({ config: config(), now: () => NOW })
  await assert.rejects(
    () => signer.signForUser({ supabaseUserId: 'not-a-uuid' }),
    error => error.code === 'supabase-jwt-invalid-subject',
  )
})
