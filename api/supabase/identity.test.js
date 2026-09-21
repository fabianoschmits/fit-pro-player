import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeAuthenticatedUser,
  normalizeLegacyIdentityLink,
  normalizeProfile,
  normalizeRole,
} from './contracts.js'
import { createIdentityRepository, createLegacyIdentityContext } from './identity.js'

const USER_ID = '00000000-0000-0000-0000-000000000001'
const OTHER_USER_ID = '00000000-0000-0000-0000-000000000002'
const legacyUser = createLegacyIdentityContext({ id: 'legacy-student', name: 'Legacy Student', admin: false })

function result(data, error = null) { return { data, error } }

function fakeQuery(rows = []) {
  const state = { rows }
  const query = {
    select() { return query },
    eq(column, value) {
      state.rows = state.rows.filter(row => row[column] === value)
      return query
    },
    maybeSingle() { return Promise.resolve(result(state.rows[0] ?? null)) },
    single() { return Promise.resolve(result(state.rows[0] ?? null)) },
    insert(value) {
      state.inserted = (Array.isArray(value) ? value : [value]).map(row => ({ created_at: '2026-01-01T00:00:00Z', linked_at: '2026-01-01T00:00:00Z', ...row }))
      for (const row of state.inserted) rows.push(row)
      state.rows = state.inserted
      return query
    },
    then(resolve, reject) { return Promise.resolve(result(state.rows)).then(resolve, reject) },
  }
  return query
}

function clients({ user = { id: USER_ID, email: 'user@example.test', user_metadata: { display_name: 'Ignored' } }, profile, roles = [], link, rpcLink } = {}) {
  const calls = []
  const tables = { profiles: profile ? [profile] : [], user_roles: roles, legacy_identity_links: link ? [link] : [] }
  const admin = {
    auth: { async getUser() { return result(user) } },
    from(table) {
      calls.push(['from', table])
      return fakeQuery(tables[table] ?? [])
    },
  }
  const pub = { auth: { async getUser(token) { calls.push(['public-token', token]); return result({ user }) } } }
  return { publicClient: pub, adminClient: admin, calls }
}

test('normalizers keep only bounded public identity fields', () => {
  assert.deepEqual(normalizeAuthenticatedUser({ id: USER_ID, email: ' a@example.test ', app_metadata: { role: 'admin' } }), { id: USER_ID, email: 'a@example.test' })
  assert.deepEqual(normalizeProfile({ id: USER_ID, display_name: ' Athlete ', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', secret: 'x' }), { id: USER_ID, displayName: 'Athlete', avatarRef: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' })
  assert.deepEqual(normalizeRole({ user_id: USER_ID, role: 'student', created_at: '2026-01-01T00:00:00Z', private: true }), { userId: USER_ID, role: 'student', createdAt: '2026-01-01T00:00:00Z' })
  assert.deepEqual(normalizeLegacyIdentityLink({ legacy_user_id: 'legacy-student', supabase_user_id: USER_ID, linked_at: '2026-01-01T00:00:00Z', status: 'active' }), { legacyUserId: 'legacy-student', supabaseUserId: USER_ID, linkedAt: '2026-01-01T00:00:00Z' })
  assert.throws(() => normalizeRole({ user_id: USER_ID, role: 'owner', created_at: 'now' }), /invalid-role/)
})

test('verifyAccessToken returns a validated identity and rejects token failures', async () => {
  const fake = clients()
  const repo = createIdentityRepository(fake)
  assert.deepEqual(await repo.verifyAccessToken('bearer-token'), { id: USER_ID, email: 'user@example.test' })

  const failing = createIdentityRepository({ publicClient: { auth: { async getUser() { return result(null, new Error('bad token')) } } }, adminClient: fake.adminClient })
  await assert.rejects(() => failing.verifyAccessToken('bad'), error => error.code === 'invalid-access-token')
  const throwing = createIdentityRepository({ publicClient: { auth: { async getUser() { throw new Error('network down') } } } })
  await assert.rejects(() => throwing.verifyAccessToken('network-error'), error => error.code === 'invalid-access-token')
})

test('repository is unavailable without injected Supabase clients', async () => {
  const repo = createIdentityRepository({})
  await assert.rejects(() => repo.verifyAccessToken('token'), error => error.code === 'supabase-unavailable')
})

test('account snapshot preserves stored display name and automatic student role', async () => {
  const fake = clients({ profile: { id: USER_ID, display_name: 'Stored Name', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', password: 'nope' }, roles: [{ user_id: USER_ID, role: 'student', created_at: '2026-01-01T00:00:00Z' }] })
  const snapshot = await createIdentityRepository(fake).getAccountSnapshot({ accessToken: 'token', legacyUser })
  assert.equal(snapshot.profile.displayName, 'Stored Name')
  assert.deepEqual(snapshot.roles, [{ userId: USER_ID, role: 'student', createdAt: '2026-01-01T00:00:00Z' }])
  assert.equal(snapshot.legacyLink, null)
  assert.equal('password' in snapshot.profile, false)
})

test('linkLegacyIdentity creates the first link and is idempotent for the same pair', async () => {
  const fake = clients({ profile: { id: USER_ID, display_name: 'Stored Name', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }, roles: [{ user_id: USER_ID, role: 'student', created_at: '2026-01-01T00:00:00Z' }] })
  const repo = createIdentityRepository(fake)
  const first = await repo.linkLegacyIdentity({ accessToken: 'token', legacyUser })
  const retry = await repo.linkLegacyIdentity({ accessToken: 'token', legacyUser })
  assert.deepEqual(first.legacyLink, retry.legacyLink)
  assert.equal(fake.calls.filter(call => call[1] === 'legacy_identity_links').length >= 2, true)
})

test('linkLegacyIdentity accepts only a marked server-session identity context', async () => {
  const fake = clients({ profile: { id: USER_ID, display_name: 'Stored Name', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } })
  const repo = createIdentityRepository(fake)
  await assert.rejects(() => repo.linkLegacyIdentity({ accessToken: 'token', legacyUser: { id: 'legacy-student' } }), error => error.code === 'invalid-legacy-context')
})

test('same-pair unique conflict is resolved by rereading the committed link', async () => {
  const link = { legacy_user_id: 'legacy-student', supabase_user_id: USER_ID, status: 'active', linked_at: '2026-01-01T00:00:00Z' }
  const base = clients({ profile: { id: USER_ID, display_name: 'Stored Name', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } })
  let inserted = false
  const admin = {
    ...base.adminClient,
    from(table) {
      if (table !== 'legacy_identity_links') return base.adminClient.from(table)
      return {
        select() { return this },
        eq(column, value) { this.column = column; this.value = value; return this },
        async maybeSingle() { return result(inserted ? link : null) },
        insert() { inserted = true; return { select() { return { async single() { return result(null, { code: '23505' }) } } } } },
      }
    },
  }
  const snapshot = await createIdentityRepository({ ...base, adminClient: admin }).linkLegacyIdentity({ accessToken: 'token', legacyUser })
  assert.equal(snapshot.legacyLink.supabaseUserId, USER_ID)
})

test('linkLegacyIdentity rejects malformed legacy users and conflicting links', async () => {
  const fake = clients({ user: { id: OTHER_USER_ID }, rpcLink: null })
  const repo = createIdentityRepository(fake)
  await assert.rejects(() => repo.linkLegacyIdentity({ accessToken: 'token', legacyUser: { id: ' ' } }), error => error.code === 'invalid-legacy-context')

  const conflict = createIdentityRepository({ ...fake, adminClient: { ...fake.adminClient, from(table) { if (table === 'legacy_identity_links') return { select() { return this }, eq() { return this }, async maybeSingle() { return result(null) }, insert() { return { select() { return { async single() { return result(null, { code: '23505' }) } } } } } }; return fake.adminClient.from(table) } } })
  await assert.rejects(() => conflict.linkLegacyIdentity({ accessToken: 'token', legacyUser }), error => error.code === 'identity-link-conflict')

  const legacyConflict = createIdentityRepository(clients({ user: { id: USER_ID }, link: { legacy_user_id: legacyUser.id, supabase_user_id: OTHER_USER_ID, linked_at: '2026-01-01T00:00:00Z' } }))
  await assert.rejects(() => legacyConflict.linkLegacyIdentity({ accessToken: 'token', legacyUser }), error => error.code === 'identity-link-conflict')

  const supabaseConflict = createIdentityRepository(clients({ user: { id: USER_ID }, link: { legacy_user_id: 'another-legacy', supabase_user_id: USER_ID, linked_at: '2026-01-01T00:00:00Z' } }))
  await assert.rejects(() => supabaseConflict.linkLegacyIdentity({ accessToken: 'token', legacyUser }), error => error.code === 'identity-link-conflict')
})

test('requestProfessionalRole inserts only professional and rejects admin escalation', async () => {
  const fake = clients({ user: { id: USER_ID }, profile: { id: USER_ID, display_name: '', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } })
  const repo = createIdentityRepository(fake)
  const role = await repo.requestProfessionalRole({ accessToken: 'token' })
  assert.equal(role.role, 'professional')
  await assert.rejects(() => repo.requestProfessionalRole({ accessToken: 'token', role: 'admin' }), error => error.code === 'invalid-role-request')
  assert.equal(fake.calls.some(call => call[1] === 'professional_profiles'), false)
})

test('duplicate professional-role request has a distinct stable error', async () => {
  const base = clients({ user: { id: USER_ID } })
  const admin = { ...base.adminClient, from(table) {
    if (table !== 'user_roles') return base.adminClient.from(table)
    return { insert() { return { select() { return { async single() { return result(null, { code: '23505' }) } } } } } }
  } }
  await assert.rejects(() => createIdentityRepository({ ...base, adminClient: admin }).requestProfessionalRole({ accessToken: 'token' }), error => error.code === 'role-already-present')
})

test('account snapshot reads the automatically created student role without pre-seeding it', async () => {
  const fake = clients({ profile: { id: USER_ID, display_name: '', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } })
  const role = { user_id: USER_ID, role: 'student', created_at: '2026-01-01T00:00:00Z' }
  const admin = { ...fake.adminClient, from(table) {
    if (table === 'profiles') return { select() { return this }, eq() { return this }, async maybeSingle() { fake.adminClient.from('user_roles')._autoRole = role; return result({ id: USER_ID, display_name: '', avatar_ref: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }) } }
    if (table === 'user_roles') return { select() { return this }, eq() { return this }, then(resolve, reject) { return Promise.resolve(result([role])).then(resolve, reject) } }
    return fake.adminClient.from(table)
  } }
  const snapshot = await createIdentityRepository({ ...fake, adminClient: admin }).getAccountSnapshot({ accessToken: 'token' })
  assert.deepEqual(snapshot.roles, [{ userId: USER_ID, role: 'student', createdAt: '2026-01-01T00:00:00Z' }])
})
