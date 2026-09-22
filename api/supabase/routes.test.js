import test from 'node:test'
import assert from 'node:assert/strict'

import { createOriginPolicy } from './origin-policy.js'
import { createSupabaseRoutes } from './routes.js'

const SUPABASE_USER_ID = '00000000-0000-0000-0000-000000000001'
const legacyUser = { id: 'legacy-user', name: 'Legacy User', admin: false }
const allowedOrigin = 'https://app.fitpro.test'

function bootstrapRoute({ session = legacyUser, body = {}, repository = {}, signer = null, headers = { origin: allowedOrigin } } = {}) {
  const writes = []
  const routes = createSupabaseRoutes({
    repository: {
      async getBootstrapIdentity() { return { supabaseUserId: SUPABASE_USER_ID } },
      ...repository,
    },
    signer: signer || {
      async signForUser() {
        return { token: 'signed-access-token', expiresIn: 300, expiresAt: '2026-09-22T12:05:00.000Z' }
      },
    },
    originPolicy: createOriginPolicy({ allowedOrigins: [allowedOrigin] }),
    readSession: () => session,
    readBody: async () => body,
    json: (res, status, payload, extraHeaders) => writes.push({ status, payload, extraHeaders }),
  })
  return { run: () => routes['POST /api/account/supabase-token']({ headers }, {}), writes }
}

test('bootstrap route derives identity from the server session and returns only the bearer contract', async () => {
  const calls = []
  const { run, writes } = bootstrapRoute({
    repository: {
      async getBootstrapIdentity(input) {
        calls.push(['identity', input])
        return { supabaseUserId: SUPABASE_USER_ID }
      },
    },
    signer: {
      async signForUser(input) {
        calls.push(['sign', input])
        return { token: 'signed-access-token', expiresIn: 300, expiresAt: '2026-09-22T12:05:00.000Z' }
      },
    },
  })

  await run()

  assert.equal(calls[0][0], 'identity')
  assert.equal(calls[0][1].legacyUser.id, legacyUser.id)
  assert.deepEqual(calls[1], ['sign', { supabaseUserId: SUPABASE_USER_ID }])
  assert.deepEqual(writes, [{
    status: 200,
    payload: {
      access_token: 'signed-access-token',
      token_type: 'Bearer',
      expires_in: 300,
      expires_at: '2026-09-22T12:05:00.000Z',
    },
    extraHeaders: { 'Cache-Control': 'no-store' },
  }])
  assert.deepEqual(Object.keys(writes[0].payload).sort(), ['access_token', 'expires_at', 'expires_in', 'token_type'])
  assert.equal(JSON.stringify(writes[0].payload).includes(SUPABASE_USER_ID), false)
})

test('bootstrap route rejects requests without a session or a valid web origin', async () => {
  const noSession = bootstrapRoute({ session: null })
  await noSession.run()
  assert.deepEqual(noSession.writes, [{ status: 401, payload: { error: 'not signed in' }, extraHeaders: undefined }])

  const invalidOrigin = bootstrapRoute({ headers: { origin: 'https://app.fitpro.test.evil.test' } })
  await invalidOrigin.run()
  assert.deepEqual(invalidOrigin.writes, [{ status: 403, payload: { error: 'invalid origin' }, extraHeaders: undefined }])

  const missingOrigin = bootstrapRoute({ headers: {} })
  await missingOrigin.run()
  assert.deepEqual(missingOrigin.writes, [{ status: 403, payload: { error: 'invalid origin' }, extraHeaders: undefined }])
})

test('bootstrap route rejects every client-supplied authority field', async () => {
  for (const field of ['user_id', 'supabase_user_id', 'role', 'email', 'claims']) {
    const { run, writes } = bootstrapRoute({ body: { [field]: 'attacker-controlled' } })
    await run()
    assert.deepEqual(writes, [{ status: 400, payload: { error: 'invalid bootstrap request' }, extraHeaders: undefined }], field)
  }
})

test('bootstrap route maps missing, revoked, and inconsistent identity links to a stable conflict', async () => {
  for (const code of ['identity-not-linked', 'identity-revoked', 'identity-inconsistent']) {
    const error = Object.assign(new Error(code), { code })
    const { run, writes } = bootstrapRoute({
      repository: { async getBootstrapIdentity() { throw error } },
    })
    await run()
    assert.deepEqual(writes, [{ status: 409, payload: { error: 'identity_not_linked' }, extraHeaders: undefined }], code)
  }
})

test('bootstrap route fails closed when the signer is unavailable', async () => {
  const error = Object.assign(new Error('unavailable'), { code: 'supabase-jwt-signing-unavailable' })
  const { run, writes } = bootstrapRoute({
    signer: { async signForUser() { throw error } },
  })
  await run()
  assert.deepEqual(writes, [{ status: 503, payload: { error: 'supabase auth bootstrap unavailable' }, extraHeaders: undefined }])
})
