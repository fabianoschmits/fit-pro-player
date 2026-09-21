const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ROLES = new Set(['student', 'professional', 'admin'])
const MAX_LEGACY_ID = 120
const MAX_EMAIL = 320
const MAX_DISPLAY_NAME = 120
const MAX_AVATAR_REF = 500

function requiredUuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new Error('invalid-user-id')
  return value.toLowerCase()
}

function optionalString(value, max, code) {
  if (value == null) return null
  if (typeof value !== 'string' || value.length > max) throw new Error(code)
  const normalized = value.trim()
  return normalized || null
}

function timestamp(value) {
  if (typeof value !== 'string' || !value || Number.isNaN(Date.parse(value))) throw new Error('invalid-timestamp')
  return value
}

export function normalizeAuthenticatedUser(input) {
  const source = input ?? {}
  const id = requiredUuid(source.id)
  const email = optionalString(source.email, MAX_EMAIL, 'invalid-email')
  return email ? { id, email } : { id, email: null }
}

export function normalizeProfile(input) {
  const source = input ?? {}
  return {
    id: requiredUuid(source.id),
    displayName: optionalString(source.display_name, MAX_DISPLAY_NAME, 'invalid-display-name') ?? '',
    avatarRef: optionalString(source.avatar_ref, MAX_AVATAR_REF, 'invalid-avatar-ref'),
    createdAt: timestamp(source.created_at),
    updatedAt: timestamp(source.updated_at),
  }
}

export function normalizeRole(input) {
  const source = input ?? {}
  const userId = requiredUuid(source.user_id)
  if (!ROLES.has(source.role)) throw new Error('invalid-role')
  return { userId, role: source.role, createdAt: timestamp(source.created_at) }
}

export function normalizeLegacyIdentityLink(input) {
  const source = input ?? {}
  const legacyUserId = optionalString(source.legacy_user_id, MAX_LEGACY_ID, 'invalid-legacy-user')
  if (!legacyUserId) throw new Error('invalid-legacy-user')
  return {
    legacyUserId,
    supabaseUserId: requiredUuid(source.supabase_user_id),
    linkedAt: timestamp(source.linked_at),
  }
}
