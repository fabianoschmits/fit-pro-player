import { ACCOUNT_CACHE_SCHEMA_VERSION, ANONYMOUS_SCOPE, storageKeyForScope } from './local-state-scope.js'
import { MAX_BACKUP_BYTES, validateBackup } from './backup-state.js'

const FORBIDDEN = new Set(['password', 'access_token', 'refresh_token', 'session', 'cookie', 'service_key', 'secret_key'])

function stateOnly(value) {
  if (Array.isArray(value)) return value.map(stateOnly)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !FORBIDDEN.has(key.toLowerCase())).map(([key, child]) => [key, stateOnly(child)]))
}

export function serializeStateOnly(state) {
  return JSON.stringify(stateOnly(state))
}

export function emptyStateForScope(_scope, defaultState) {
  return typeof structuredClone === 'function' ? structuredClone(defaultState) : JSON.parse(JSON.stringify(defaultState))
}

export function readScopedState(scope, storage, defaultState) {
  let raw
  try { raw = storage.getItem(storageKeyForScope(scope)) } catch { return { status: 'error', state: emptyStateForScope(scope, defaultState) } }
  if (!raw) return { status: 'missing', state: emptyStateForScope(scope, defaultState) }
  try {
    const parsed = JSON.parse(raw)
    if (raw.length > MAX_BACKUP_BYTES) throw new Error('invalid cache size')
    if (scope.kind === 'anonymous') { validateBackup(parsed); parsed.pendingProfessionalEvents = []; return { status: 'valid', state: parsed } }
    if (parsed?.ownerId !== scope.userId || parsed?.schemaVersion !== ACCOUNT_CACHE_SCHEMA_VERSION || !parsed.state || typeof parsed.state !== 'object') {
      return { status: 'invalid', state: emptyStateForScope(scope, defaultState) }
    }
    validateBackup(parsed.state)
    parsed.state.pendingProfessionalEvents = (parsed.state.pendingProfessionalEvents || []).filter(event => event.accountId === scope.userId)
    return { status: 'valid', state: parsed.state }
  } catch {
    return { status: 'invalid', state: emptyStateForScope(scope, defaultState) }
  }
}

export function writeScopedState(scope, state, storage) {
  try {
  const payload = scope.kind === 'anonymous'
    ? stateOnly(state)
    : { ownerId: scope.userId, schemaVersion: ACCOUNT_CACHE_SCHEMA_VERSION, state: stateOnly(state) }
  const serialized = scope.kind === 'anonymous'
    ? serializeStateOnly(state)
    : JSON.stringify({ ...payload, state: JSON.parse(serializeStateOnly(state)) })
    storage.setItem(storageKeyForScope(scope), serialized)
    return true
  } catch {
    return false
  }
}
