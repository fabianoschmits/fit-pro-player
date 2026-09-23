export const ANONYMOUS_SCOPE = Object.freeze({ kind: 'anonymous', userId: null })
export const ACCOUNT_CACHE_SCHEMA_VERSION = 1

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function resolveLocalScope(userId) {
  if (userId == null || userId === '') return ANONYMOUS_SCOPE
  if (typeof userId !== 'string' || !UUID.test(userId.trim())) throw new Error('Invalid Supabase user id')
  return Object.freeze({ kind: 'account', userId: userId.trim().toLowerCase() })
}

export function storageKeyForScope(scope) {
  if (scope?.kind === 'anonymous' && scope.userId === null) return 'gym_state_v1'
  if (scope?.kind === 'account' && UUID.test(scope.userId || '')) return `fpp_account_cache_v1:${scope.userId}`
  throw new Error('Invalid local state scope')
}

export function nativePathForScope(scope) {
  if (scope?.kind === 'anonymous' && scope.userId === null) return 'fitproplayer-state.json'
  if (scope?.kind === 'account' && UUID.test(scope.userId || '')) return `fitproplayer-account-v1-${scope.userId}.json`
  throw new Error('Invalid local state scope')
}
