import { MASS_UNIT } from './mass.js'

export const SESSION_RECOVERY_SCHEMA_VERSION = 1
const KEY_PREFIX = 'fpp_active_session_v1:'
const OPERATION_KINDS = new Set(['set_upserted', 'set_removed', 'exercise_added', 'exercise_removed', 'session_completed', 'session_abandoned'])

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const isText = value => typeof value === 'string' && value.length > 0
const nullableText = value => value === null || isText(value)
const copy = value => JSON.parse(JSON.stringify(value))

export function sessionRecoveryKey(accountId) {
  if (!isText(accountId)) throw new TypeError('invalid-session-recovery-account')
  return `${KEY_PREFIX}${accountId}`
}

function validSession(session, accountId, phase) {
  const starting = phase === 'starting'
  return isObject(session)
    && isText(session.id)
    && session.accountId === accountId
    && nullableText(session.routineId)
    && nullableText(session.assignmentId)
    && (starting ? session.status === 'starting' : ['active', 'completed', 'abandoned'].includes(session.status))
    && Number.isSafeInteger(session.revision)
    && session.revision >= (starting ? 0 : 1)
    && (starting ? session.writerToken === null : isText(session.writerToken))
    && session.massUnit === MASS_UNIT
    && isObject(session.prescriptionSnapshot)
    && (starting ? nullableText(session.startedAt) : isText(session.startedAt))
    && nullableText(session.completedAt)
    && nullableText(session.updatedAt)
}

function validOperation(operation) {
  return isObject(operation)
    && isText(operation.operationId)
    && OPERATION_KINDS.has(operation.kind)
    && isObject(operation.payload)
}

function parseDraft(raw, accountId) {
  if (!isObject(raw)
    || raw.schemaVersion !== SESSION_RECOVERY_SCHEMA_VERSION
    || raw.accountId !== accountId
    || !['starting', 'active', 'completing', 'abandoning'].includes(raw.phase)
    || !validSession(raw.session, accountId, raw.phase)
    || !Array.isArray(raw.pendingOperations)
    || !raw.pendingOperations.every(validOperation)
    || !Number.isFinite(raw.updatedAt)) return null
  return copy(raw)
}

export function readSessionRecoveryDraft({ accountId, storage = globalThis.localStorage }) {
  const key = sessionRecoveryKey(accountId)
  let stored
  try {
    stored = storage?.getItem(key)
    if (!stored) return null
    const draft = parseDraft(JSON.parse(stored), accountId)
    if (draft) return draft
  } catch {
    // A partial/corrupt write cannot be trusted or sent to another account.
  }
  try { storage?.removeItem(key) } catch { /* status is reported by the next write */ }
  return null
}

export function hasPendingSessionCompletion(draft) {
  return !!draft?.pendingOperations?.some(operation => operation.kind === 'session_completed')
}

export function hasPendingSessionFinalization(draft) {
  return !!draft?.pendingOperations?.some(operation => ['session_completed', 'session_abandoned'].includes(operation.kind))
}

function recoveryState(error) {
  if (['forbidden', 'unauthorized', 'session-expired', 'auth-required'].includes(error?.kind)) return 'auth-required'
  if (['stale-writer', 'revision-conflict'].includes(error?.kind)) return 'takeover-required'
  if (error?.kind === 'offline' || error?.retryable) return 'waiting'
  return 'failed'
}

function serverSession(session) {
  return {
    id: session.id,
    accountId: session.accountId,
    routineId: session.routineId ?? null,
    assignmentId: session.assignmentId ?? null,
    status: session.status,
    revision: session.revision,
    writerToken: session.writerToken,
    massUnit: session.massUnit,
    prescriptionSnapshot: copy(session.prescriptionSnapshot),
    startedAt: session.startedAt,
    completedAt: session.completedAt ?? null,
    updatedAt: session.updatedAt,
  }
}

export function createSessionRecovery({ repository, accountId, storage = globalThis.localStorage, now = Date.now, onStatus = () => {} }) {
  if (!repository || !isText(accountId) || !storage) throw new TypeError('invalid-session-recovery-scope')
  const key = sessionRecoveryKey(accountId)
  let current = readSessionRecoveryDraft({ accountId, storage })
  let inFlight = null

  const publish = (state, extra = {}) => {
    const value = { state, pending: current?.pendingOperations?.length || 0, ...extra }
    onStatus(value)
    return value
  }
  const persist = draft => {
    const next = { ...copy(draft), schemaVersion: SESSION_RECOVERY_SCHEMA_VERSION, accountId, updatedAt: Number(now()) }
    storage.setItem(key, JSON.stringify(next))
    current = next
    return copy(next)
  }
  const clear = () => {
    storage.removeItem(key)
    current = null
  }
  const fail = error => publish(recoveryState(error), { error: error?.kind || 'request-failed' })

  async function dispatch() {
    if (!current) return publish('idle')
    publish('saving')
    try {
      if (current.phase === 'starting') {
        const session = await repository.startSession({
          sessionId: current.session.id,
          prescriptionSnapshot: copy(current.session.prescriptionSnapshot),
          routineId: current.session.routineId,
          assignmentId: current.session.assignmentId,
        })
        persist({ ...current, phase: 'active', session: serverSession(session) })
      }

      while (current?.pendingOperations.length) {
        const queued = current.pendingOperations[0]
        const request = {
          sessionId: current.session.id,
          writerToken: current.session.writerToken,
          expectedRevision: current.session.revision,
          operationId: queued.operationId,
          payload: copy(queued.payload),
        }
        const session = queued.kind === 'session_completed'
          ? await repository.completeSession(request)
          : queued.kind === 'session_abandoned'
            ? await repository.abandonSession(request)
            : await repository.appendOperation({ ...request, kind: queued.kind })

        const remaining = current.pendingOperations.slice(1)
        if (session.status === 'completed' && remaining.length === 0) {
          clear()
          return publish('saved', { completed: true, session })
        }
        if (session.status === 'abandoned' && remaining.length === 0) {
          clear()
          return publish('saved', { abandoned: true, session })
        }
        persist({
          ...current,
          phase: remaining.some(item => item.kind === 'session_completed') ? 'completing'
            : remaining.some(item => item.kind === 'session_abandoned') ? 'abandoning' : 'active',
          session: serverSession(session),
          pendingOperations: remaining,
        })
      }
      return publish('saved', { session: current.session })
    } catch (error) {
      // A restored account can retain a valid PWA draft after its server-side
      // session was removed. Recreate that same id, then replay its queued work.
      if (error?.kind === 'session-missing' && current?.phase !== 'starting') {
        persist({ ...current, phase: 'starting', session: { ...current.session, status: 'starting', revision: 0, writerToken: null, startedAt: null, completedAt: null, updatedAt: null } })
        return dispatch()
      }
      return fail(error)
    }
  }

  const flush = () => {
    if (inFlight) return inFlight
    inFlight = dispatch().finally(() => { inFlight = null })
    return inFlight
  }

  return {
    getDraft: () => current ? copy(current) : null,
    adopt(session) {
      if (session.accountId !== accountId || session.massUnit !== MASS_UNIT || session.status !== 'active') throw new TypeError('invalid-session-recovery-session')
      persist({ phase: 'active', session: serverSession(session), pendingOperations: [] })
      return publish('saved', { session })
    },
    async start({ sessionId, prescriptionSnapshot, routineId = null, assignmentId = null }) {
      if (hasPendingSessionFinalization(current)) throw new Error('pending-session-completion')
      if (current) throw new Error('active-session-recovery')
      if (!isText(sessionId) || !isObject(prescriptionSnapshot)) throw new TypeError('invalid-session-start')
      persist({
        phase: 'starting',
        session: {
          id: sessionId, accountId, routineId, assignmentId, status: 'starting', revision: 0,
          writerToken: null, massUnit: MASS_UNIT, prescriptionSnapshot: copy(prescriptionSnapshot),
          startedAt: null, completedAt: null, updatedAt: null,
        },
        pendingOperations: [],
      })
      return flush()
    },
    enqueue(queued) {
      if (!current || !validOperation(queued) || queued.kind === 'session_completed') {
        throw new TypeError('invalid-session-operation')
      }
      if (current.pendingOperations.some(item => item.operationId === queued.operationId)) return flush()
      persist({ ...current, pendingOperations: [...current.pendingOperations, copy(queued)] })
      return flush()
    },
    complete(queued) {
      if (!current || !validOperation(queued) || queued.kind !== 'session_completed') {
        throw new TypeError('invalid-session-completion')
      }
      if (!current.pendingOperations.some(item => item.operationId === queued.operationId)) {
        persist({ ...current, phase: 'completing', pendingOperations: [...current.pendingOperations, copy(queued)] })
      }
      return flush()
    },
    abandon(queued) {
      if (!current || !validOperation(queued) || queued.kind !== 'session_abandoned') {
        throw new TypeError('invalid-session-abandonment')
      }
      if (!current.pendingOperations.some(item => item.operationId === queued.operationId)) {
        persist({ ...current, phase: 'abandoning', pendingOperations: [...current.pendingOperations, copy(queued)] })
      }
      return flush()
    },
    flush,
    async takeOver() {
      if (!current || current.phase === 'starting') throw new Error('no-active-session')
      publish('saving')
      try {
        const latest = typeof repository.loadActiveSession === 'function'
          ? await repository.loadActiveSession()
          : current.session
        if (!latest || latest.id !== current.session.id || latest.status !== 'active') {
          return publish('failed', { error: 'session-finalized', pending: current.pendingOperations.length })
        }
        persist({ ...current, session: serverSession(latest) })
        const session = await repository.takeOverSession({ sessionId: current.session.id, expectedRevision: latest.revision })
        persist({ ...current, session: serverSession(session) })
      } catch (error) {
        return fail(error)
      }
      return flush()
    },
    clear() {
      clear()
      return publish('idle')
    },
  }
}
