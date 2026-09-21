import {
  normalizeAuthenticatedUser,
  normalizeLegacyIdentityLink,
  normalizeProfile,
  normalizeRole,
} from './contracts.js'

const LEGACY_CONTEXT = Symbol('fpp.server-session-legacy-identity')

function failure(code, message = code) {
  const error = new Error(message)
  error.code = code
  return error
}

function requireClient(client) {
  if (!client) throw failure('supabase-unavailable')
  return client
}

export function createLegacyIdentityContext(sessionUser) {
  if (!sessionUser || typeof sessionUser.id !== 'string' || !sessionUser.id.trim() || sessionUser.id.length > 120) {
    throw failure('invalid-legacy-context')
  }
  return Object.freeze({
    id: sessionUser.id.trim(),
    name: typeof sessionUser.name === 'string' ? sessionUser.name : null,
    admin: sessionUser.admin === true,
    [LEGACY_CONTEXT]: true,
  })
}

function legacyId(legacyContext) {
  if (!legacyContext?.[LEGACY_CONTEXT]) throw failure('invalid-legacy-context')
  return legacyContext.id
}

function checkError(error, fallback) {
  if (!error) return
  if (error.code === '23505') throw failure('identity-link-conflict')
  throw failure(fallback)
}

export function createIdentityRepository({ publicClient = null, adminClient = null } = {}) {
  const verifyAccessToken = async accessToken => {
    if (typeof accessToken !== 'string' || !accessToken.trim()) throw failure('invalid-access-token')
    const client = requireClient(publicClient)
    let response
    try { response = await client.auth.getUser(accessToken) }
    catch { throw failure('invalid-access-token') }
    if (response?.error || !response?.data?.user) throw failure('invalid-access-token')
    try { return normalizeAuthenticatedUser(response.data.user) }
    catch { throw failure('invalid-access-token') }
  }

  const readSnapshot = async user => {
    const client = requireClient(adminClient)
    const profileResponse = await client.from('profiles').select('*').eq('id', user.id).maybeSingle()
    checkError(profileResponse?.error, 'account-read-failed')
    if (!profileResponse?.data) throw failure('account-not-found')
    const rolesResponse = await client.from('user_roles').select('*').eq('user_id', user.id)
    checkError(rolesResponse?.error, 'account-read-failed')
    const linkResponse = await client.from('legacy_identity_links').select('*').eq('supabase_user_id', user.id).maybeSingle()
    checkError(linkResponse?.error, 'account-read-failed')
    return {
      profile: normalizeProfile(profileResponse.data),
      roles: (rolesResponse?.data ?? []).map(normalizeRole),
      legacyLink: linkResponse?.data ? normalizeLegacyIdentityLink(linkResponse.data) : null,
    }
  }

  const getAccountSnapshot = async ({ accessToken, legacyUser } = {}) => {
    const user = await verifyAccessToken(accessToken)
    if (legacyUser !== undefined) legacyId(legacyUser)
    return readSnapshot(user)
  }

  const linkLegacyIdentity = async ({ accessToken, legacyUser } = {}) => {
    const currentLegacyId = legacyId(legacyUser)
    const user = await verifyAccessToken(accessToken)
    const client = requireClient(adminClient)
    if (typeof client.rpc !== 'function') throw failure('identity-link-failed')
    let response
    try {
      response = await client.rpc('link_legacy_identity', {
        p_legacy_user_id: currentLegacyId,
        p_supabase_user_id: user.id,
      })
    } catch (error) {
      response = { error }
    }
    checkError(response?.error, 'identity-link-failed')
    if (!response?.data) throw failure('identity-link-failed')
    return readSnapshot(user)
  }

  const requestProfessionalRole = async ({ accessToken, role } = {}) => {
    if (role !== undefined && role !== 'professional') throw failure('invalid-role-request')
    const user = await verifyAccessToken(accessToken)
    const client = requireClient(adminClient)
    const response = await client.from('user_roles').insert({ user_id: user.id, role: 'professional' }).select('*').single()
    if (response?.error?.code === '23505') throw failure('role-already-present')
    checkError(response?.error, 'role-request-failed')
    if (!response?.data) throw failure('role-request-failed')
    return normalizeRole(response.data)
  }

  return { verifyAccessToken, getAccountSnapshot, linkLegacyIdentity, requestProfessionalRole }
}
