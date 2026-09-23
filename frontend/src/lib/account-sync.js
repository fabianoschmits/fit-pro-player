import { ACCOUNT_CACHE_SCHEMA_VERSION } from './local-state-scope.js'
import { serializeStateOnly } from './account-cache.js'

export const REMOTE_SYNC_STATE = Object.freeze({
  REMOTE_ABSENT: 'REMOTE_ABSENT',
  REMOTE_AVAILABLE: 'REMOTE_AVAILABLE',
  IN_SYNC: 'IN_SYNC',
  LOCAL_AHEAD: 'LOCAL_AHEAD',
  REMOTE_AHEAD: 'REMOTE_AHEAD',
  CONFLICT: 'CONFLICT',
  OFFLINE: 'OFFLINE',
  ERROR: 'ERROR',
})

const META_PREFIX = 'fpp_account_sync_v1:'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isObject = value => value && typeof value === 'object' && !Array.isArray(value)

export function syncMetadataKey(scope) {
  if (scope?.kind !== 'account' || !UUID.test(scope.userId || '')) return null
  return `${META_PREFIX}${scope.userId}`
}

export function readSyncMetadata(scope, storage = globalThis.localStorage) {
  const key = syncMetadataKey(scope)
  if (!key) return { revision: 0, dirty: false }
  try {
    const parsed = JSON.parse(storage.getItem(key) || '{}')
    return {
      revision: Number.isSafeInteger(parsed.revision) && parsed.revision >= 0 ? parsed.revision : 0,
      dirty: parsed.dirty === true,
    }
  } catch {
    return { revision: 0, dirty: false }
  }
}

export function writeSyncMetadata(scope, metadata, storage = globalThis.localStorage) {
  const key = syncMetadataKey(scope)
  if (!key) return false
  try {
    storage.setItem(key, JSON.stringify({
      revision: Math.max(0, Number(metadata?.revision) || 0),
      dirty: metadata?.dirty === true,
    }))
    return true
  } catch {
    return false
  }
}

export function validateRemoteSnapshot(row, ownerId, schemaVersion = ACCOUNT_CACHE_SCHEMA_VERSION) {
  if (!isObject(row) || row.user_id !== ownerId) return null
  if (!Number.isSafeInteger(row.revision) || row.revision <= 0) return null
  if (row.state_schema_version !== schemaVersion) return null
  if (!isObject(row.payload)) return null
  return Object.freeze({
    userId: row.user_id,
    revision: row.revision,
    stateSchemaVersion: row.state_schema_version,
    payload: row.payload,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  })
}

function responseData(response) {
  return Array.isArray(response?.data) ? response.data[0] : response?.data
}

function isOffline(error, online) {
  return online() === false || !error?.code && /network|fetch|offline|failed to fetch/i.test(error?.message || '')
}

export function createAccountSyncService({
  client,
  scope,
  generation = 0,
  isCurrent = () => true,
  storage = globalThis.localStorage,
  online = () => globalThis.navigator?.onLine !== false,
  schemaVersion = ACCOUNT_CACHE_SCHEMA_VERSION,
} = {}) {
  if (scope?.kind !== 'account' || !UUID.test(scope.userId || '')) {
    return Object.freeze({
      fetchRemoteSnapshot: async () => ({ state: REMOTE_SYNC_STATE.ERROR, error: 'account-scope-required' }),
      uploadSnapshot: async () => ({ state: REMOTE_SYNC_STATE.ERROR, error: 'account-scope-required' }),
      sync: async () => ({ state: REMOTE_SYNC_STATE.ERROR, error: 'account-scope-required' }),
    })
  }

  const current = () => isCurrent(generation, scope)
  const fetchRemoteSnapshot = async () => {
    if (!current()) return { state: REMOTE_SYNC_STATE.ERROR, error: 'stale-scope' }
    if (!client || typeof client.from !== 'function') return { state: REMOTE_SYNC_STATE.ERROR, error: 'sync-unavailable' }
    if (!online()) return { state: REMOTE_SYNC_STATE.OFFLINE, error: 'offline' }
    try {
      const response = await client.from('account_snapshots')
        .select('user_id,revision,state_schema_version,payload,updated_at')
        .eq('user_id', scope.userId)
        .maybeSingle()
      if (!current()) return { state: REMOTE_SYNC_STATE.ERROR, error: 'stale-scope' }
      if (response?.error) {
        if (response.error.code === 'PGRST116') return { state: REMOTE_SYNC_STATE.REMOTE_ABSENT, snapshot: null }
        return { state: isOffline(response.error, online) ? REMOTE_SYNC_STATE.OFFLINE : REMOTE_SYNC_STATE.ERROR, error: 'remote-read-failed' }
      }
      if (!response?.data) return { state: REMOTE_SYNC_STATE.REMOTE_ABSENT, snapshot: null }
      const snapshot = validateRemoteSnapshot(response.data, scope.userId, schemaVersion)
      if (!snapshot) return { state: REMOTE_SYNC_STATE.ERROR, error: 'invalid-remote-snapshot' }
      return { state: REMOTE_SYNC_STATE.REMOTE_AVAILABLE, snapshot }
    } catch (error) {
      return { state: isOffline(error, online) ? REMOTE_SYNC_STATE.OFFLINE : REMOTE_SYNC_STATE.ERROR, error: 'remote-read-failed' }
    }
  }

  const uploadSnapshot = async ({ state, expectedRevision = readSyncMetadata(scope, storage).revision } = {}) => {
    if (!current()) return { state: REMOTE_SYNC_STATE.ERROR, error: 'stale-scope' }
    if (!client || typeof client.rpc !== 'function') return { state: REMOTE_SYNC_STATE.ERROR, error: 'sync-unavailable' }
    if (!online()) return { state: REMOTE_SYNC_STATE.OFFLINE, error: 'offline' }
    let payload
    try { payload = JSON.parse(serializeStateOnly(state)) } catch { return { state: REMOTE_SYNC_STATE.ERROR, error: 'invalid-local-state' } }
    if (!isObject(payload)) return { state: REMOTE_SYNC_STATE.ERROR, error: 'invalid-local-state' }
    try {
      const response = await client.rpc('save_own_account_snapshot', {
        p_expected_revision: expectedRevision,
        p_state_schema_version: schemaVersion,
        p_payload: payload,
      })
      if (!current()) return { state: REMOTE_SYNC_STATE.ERROR, error: 'stale-scope' }
      if (response?.error) return { state: isOffline(response.error, online) ? REMOTE_SYNC_STATE.OFFLINE : REMOTE_SYNC_STATE.ERROR, error: 'remote-write-failed' }
      const result = responseData(response)
      if (!isObject(result) || !['APPLIED', 'CONFLICT'].includes(result.status)) {
        return { state: REMOTE_SYNC_STATE.ERROR, error: 'invalid-cas-response' }
      }
      if (result.status === 'CONFLICT') {
        return {
          state: REMOTE_SYNC_STATE.CONFLICT,
          remoteRevision: Number.isSafeInteger(result.revision) ? result.revision : null,
          updatedAt: result.updated_at || null,
        }
      }
      const revision = Number(result.revision)
      if (!Number.isSafeInteger(revision) || revision <= 0) return { state: REMOTE_SYNC_STATE.ERROR, error: 'invalid-cas-response' }
      writeSyncMetadata(scope, { revision, dirty: false }, storage)
      return { state: REMOTE_SYNC_STATE.IN_SYNC, revision, updatedAt: result.updated_at || null }
    } catch (error) {
      return { state: isOffline(error, online) ? REMOTE_SYNC_STATE.OFFLINE : REMOTE_SYNC_STATE.ERROR, error: 'remote-write-failed' }
    }
  }

  const sync = async ({ state, dirty = readSyncMetadata(scope, storage).dirty } = {}) => {
    const result = await fetchRemoteSnapshot()
    if (result.state !== REMOTE_SYNC_STATE.REMOTE_AVAILABLE) return result
    const metadata = readSyncMetadata(scope, storage)
    if (dirty || metadata.revision > result.snapshot.revision) {
      return { state: REMOTE_SYNC_STATE.LOCAL_AHEAD, snapshot: result.snapshot }
    }
    if (metadata.revision < result.snapshot.revision) {
      return { state: REMOTE_SYNC_STATE.REMOTE_AHEAD, snapshot: result.snapshot }
    }
    return { state: REMOTE_SYNC_STATE.IN_SYNC, snapshot: result.snapshot }
  }

  return Object.freeze({ fetchRemoteSnapshot, uploadSnapshot, sync })
}
