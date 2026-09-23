export const LEGACY_MIGRATION_STATE = Object.freeze({
  LEGACY_ONLY: 'LEGACY_ONLY',
  SUPABASE_ONLY: 'SUPABASE_ONLY',
  AVAILABLE: 'AVAILABLE',
  ALREADY_LINKED: 'ALREADY_LINKED',
  UNAVAILABLE: 'UNAVAILABLE',
})

export function legacyMigrationState({ legacyUser, supabaseUser, legacyLink } = {}) {
  if (legacyLink?.status === 'active') return LEGACY_MIGRATION_STATE.ALREADY_LINKED
  if (legacyUser?.id && supabaseUser?.id) return LEGACY_MIGRATION_STATE.AVAILABLE
  if (legacyUser?.id) return LEGACY_MIGRATION_STATE.LEGACY_ONLY
  if (supabaseUser?.id) return LEGACY_MIGRATION_STATE.SUPABASE_ONLY
  return LEGACY_MIGRATION_STATE.UNAVAILABLE
}

export async function linkLegacyAccount({ client, fetchImpl = fetch } = {}) {
  if (!client?.auth?.getSession) throw new Error('supabase-auth-required')
  const sessionResult = await client.auth.getSession()
  const accessToken = sessionResult?.data?.session?.access_token
  if (!accessToken) throw new Error('supabase-session-required')
  const response = await fetchImpl('/api/account/identity-link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!response.ok) {
    const error = new Error(response.status === 409 ? 'identity-link-conflict' : 'identity-link-failed')
    error.status = response.status
    throw error
  }
  return response.json()
}
