import { createLegacyIdentityContext } from './identity.js'

const errors = Object.freeze({
  unavailable: [503, 'account unavailable'],
  unauthenticated: [401, 'not signed in'],
  conflict: [409, 'identity link conflict'],
  roleExists: [409, 'professional role already exists'],
})

function bearerToken(req) {
  const value = req.headers?.authorization
  if (typeof value !== 'string') return null
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim())
  return match?.[1] || null
}

function errorResponse(error) {
  if (error?.code === 'supabase-unavailable') return errors.unavailable
  if (error?.code === 'invalid-access-token' || error?.code === 'invalid-legacy-context') return errors.unauthenticated
  if (error?.code === 'identity-link-conflict') return errors.conflict
  if (error?.code === 'role-already-present') return errors.roleExists
  if (error?.code === 'invalid-role-request') return [400, 'invalid role request']
  return [500, 'account unavailable']
}

function sendFailure(json, res, error) {
  const [status, message] = errorResponse(error)
  json(res, status, { error: message })
}

export function createSupabaseRoutes({ repository, readSession, readBody, json }) {
  const authenticated = req => {
    const accessToken = bearerToken(req)
    if (!accessToken) return null
    return { accessToken, legacyUser: readSession(req) }
  }

  const legacyContext = legacyUser => legacyUser ? createLegacyIdentityContext(legacyUser) : undefined

  return {
    'GET /api/account': async (req, res) => {
      const auth = authenticated(req)
      if (!auth) return json(res, ...errors.unauthenticated.map((value, index) => index ? { error: value } : value))
      try {
        const account = await repository.getAccountSnapshot({ accessToken: auth.accessToken, legacyUser: legacyContext(auth.legacyUser) })
        json(res, 200, { account })
      } catch (error) { sendFailure(json, res, error) }
    },

    'POST /api/account/identity-link': async (req, res) => {
      const auth = authenticated(req)
      if (!auth?.legacyUser) return json(res, 401, { error: 'not signed in' })
      try {
        await readBody(req)
        const account = await repository.linkLegacyIdentity({
          accessToken: auth.accessToken,
          legacyUser: legacyContext(auth.legacyUser),
        })
        json(res, 200, { account })
      } catch (error) { sendFailure(json, res, error) }
    },

    'POST /api/account/roles/professional': async (req, res) => {
      const auth = authenticated(req)
      if (!auth) return json(res, 401, { error: 'not signed in' })
      try {
        await readBody(req)
        const role = await repository.requestProfessionalRole({ accessToken: auth.accessToken })
        json(res, 200, { role })
      } catch (error) { sendFailure(json, res, error) }
    },
  }
}
