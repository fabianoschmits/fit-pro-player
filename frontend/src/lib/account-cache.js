import { migrateLocalState } from './local-state-migrations.js'
import { projectPersistedState } from './persisted-state.js'
import { ACCOUNT_CACHE_SCHEMA_VERSION, storageKeyForScope } from './local-state-scope.js'
import { MAX_BACKUP_BYTES, validateBackup } from './backup-state.js'

const stateOnly = value => projectPersistedState(value) || {}

export function serializeStateOnly(state) {
  return JSON.stringify(stateOnly(state))
}

export function emptyStateForScope(_scope, defaultState) {
  return typeof structuredClone === 'function' ? structuredClone(defaultState) : JSON.parse(JSON.stringify(defaultState))
}

export function readScopedState(scope, storage, defaultState) {
  const key = storageKeyForScope(scope)
  let raw, state
  try { raw = storage.getItem(key) } catch { return { status: 'error', state: emptyStateForScope(scope, defaultState) } }
  if (!raw) return { status: 'missing', state: emptyStateForScope(scope, defaultState) }
  try {
    if (raw.length > MAX_BACKUP_BYTES) throw new Error('invalid cache size')
    const parsed = JSON.parse(raw)
    if (scope.kind === 'account' && (parsed?.ownerId !== scope.userId || parsed?.schemaVersion !== ACCOUNT_CACHE_SCHEMA_VERSION)) {
      storage.removeItem(key)
      return { status: 'invalid', state: emptyStateForScope(scope, defaultState) }
    }
    const source = scope.kind === 'account' ? parsed.state : parsed
    if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('invalid cache state')
    state = migrateLocalState(source)
    state.routines ??= []
    state.workouts ??= []
    validateBackup(state)
    state = stateOnly(state)
    state.pendingProfessionalEvents = scope.kind === 'anonymous' ? [] : (state.pendingProfessionalEvents || []).filter(event => event.accountId === scope.userId)
  } catch {
    try {
      const parsed = JSON.parse(raw)
      const safe = stateOnly(scope.kind === 'account' ? parsed?.state : parsed)
      storage.setItem(key + ':recovery', JSON.stringify(safe))
      storage.removeItem(key)
    } catch { /* malformed JSON cannot be copied without risking embedded credentials */ }
    return { status: 'invalid', state: emptyStateForScope(scope, defaultState) }
  }
  const clean = scope.kind === 'anonymous' ? state : { ownerId: scope.userId, schemaVersion: ACCOUNT_CACHE_SCHEMA_VERSION, state }
  try { storage.setItem(key, JSON.stringify(clean)) }
  catch { return { status: 'error', state } }
  return { status: 'valid', state }
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
