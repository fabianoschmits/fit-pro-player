import { bodyInput, bodyWire } from './body-sync-state.js'
import { mergeChanges } from './three-way-merge.js'
import { applyDomainState } from './domain-state.js'
import { bodyFingerprint, planFingerprint, preferenceFingerprint, preferenceValues } from './domain-sync-state.js'

const DOMAINS = ['plan', 'body', 'preferences', 'history']
const fingerprints = { plan: planFingerprint, body: bodyFingerprint, preferences: preferenceFingerprint }


/** Sends account changes immediately when connected. Local state is the durable pending journal. */
export function createAccountDomainSync({ repository, getState, replaceState, isCurrent, isOnline, onStatus = _status => {}, onCommitted = (_domain, _revision) => {} }) {
  let started = false
  let disposed = false
  let planRevision = 0
  let preferenceRevision = 0
  let bodyRevision = getState().bodyServerRevision || 0
  const bases = new Map(Object.entries(getState()._syncBases || {}))
  const failures = new Map(Object.keys(getState()._syncConflicts || {}).filter(domain => getState()._pendingSync?.[domain]).map(domain => [domain, 'sync-conflict']))
  const inFlight = new Map()
  const retryTimers = new Map()
  const retryAttempts = new Map()
  const firstRead = new Set(DOMAINS)
  const deletedWorkouts = new Set()
  const current = () => !disposed && isCurrent()
  const isPending = domain => domain === 'history'
    ? !!getState()._pendingWorkoutDeletes?.length
    : !!getState()._pendingSync?.[domain]
  const pending = () => DOMAINS.filter(isPending)
  const status = () => {
    const count = pending().length
    const error = failures.values().next().value || null
    return { state: !count ? 'saved' : !isOnline() ? 'queued' : error ? 'error' : inFlight.size ? 'saving' : 'queued', pending: count, error }
  }
  const publish = () => onStatus(status())

  function inputFor(domain, state) {
    if (domain === 'body') return bodyInput(state)
    if (domain === 'preferences') return { displayUnit: state.displayUnit, values: preferenceValues(state) }
    return {
      mode: state.planMode, schedule: { week: state.week, dayPlan: state.dayPlan, ...(state.assignedProgram ? { assignedProgram: state.assignedProgram } : {}), ...(state.activeLibraryId ? { libraryId: state.activeLibraryId, libraryTitle: state.activeLibraryTitle } : {}) },
      routines: state.routines.map(({ id, name, ...prescription }) => ({ id, title: name || 'Routine', prescription })),
    }
  }

  async function save(domain, state) {
    if (domain === 'history') return repository.deleteCompletedWorkout({ sessionId: state._pendingWorkoutDeletes[0] })
    if (domain === 'body') return saveWithMerge(domain, inputFor(domain, state), bodyRevision)
    if (domain === 'plan') {
      const input = inputFor(domain, state)
      return saveWithMerge(domain, input, Math.max(planRevision, state.planServerRevision || 0))
    }
    const input = { displayUnit: state.displayUnit, values: preferenceValues(state) }
    return saveWithMerge(domain, input, preferenceRevision)
  }

  function wire(domain, data) {
    if (domain === 'body') return bodyWire(data)
    if (domain === 'preferences') return { displayUnit: data.displayUnit, values: data.values || {} }
    return { mode: data.schedule?.mode || 'weekly', schedule: data.schedule?.values || {},
      routines: data.routines.map(({ id, title, prescription }) => ({ id, title, prescription })) }
  }

  async function saveWithMerge(domain, input, revision) {
    const send = (value, expectedRevision) => domain === 'plan'
      ? repository.savePlan({ ...value, expectedRevision })
      : domain === 'body' ? repository.saveBody({ ...value, expectedRevision })
      : repository.savePreferences({ ...value, expectedRevision })
    try { return await send(input, revision) }
    catch (error) {
      if (error?.kind !== 'revision-conflict') throw error
      const fresh = await (domain === 'plan' ? repository.loadPlan() : domain === 'body' ? repository.loadBody() : repository.loadPreferences())
      const remote = wire(domain, fresh)
      let merged
      try {
        if (!bases.has(domain)) throw Object.assign(new Error('sync-conflict'), { kind: 'sync-conflict' })
        merged = mergeChanges(bases.get(domain), input, remote)
      } catch (conflict) {
        // Durable, account-scoped recovery. Never acknowledge or discard local pending edits.
        if (current()) replaceState({ ...getState(), _syncConflicts: { ...getState()._syncConflicts,
          [domain]: { base: bases.get(domain) || null, local: input, remote, path: conflict.path || '' } } })
        throw Object.assign(conflict, { retryable: false })
      }
      try { return await send(merged, domain === 'plan' ? fresh.schedule?.revision || 0 : fresh.revision) }
      catch (retryError) {
        if (retryError?.kind === 'revision-conflict') {
          if (current()) replaceState({ ...getState(), _syncConflicts: { ...getState()._syncConflicts,
            [domain]: { base: bases.get(domain), local: input, remote } } })
          throw Object.assign(new Error('sync-conflict'), { kind: 'sync-conflict', retryable: false })
        }
        throw retryError
      }
    }
  }

  function recordRevision(domain, data) {
    if (domain === 'plan') planRevision = Math.max(planRevision, data.schedule?.revision || 0, getState().planServerRevision || 0)
    if (domain === 'preferences') preferenceRevision = data.revision || 0
    if (domain === 'body') bodyRevision = Math.max(bodyRevision, data.revision || 0)
  }

  function acceptRemote(domain, data) {
    if (!current()) return
    if (domain === 'body' && data.revision < bodyRevision) return
    const initial = firstRead.delete(domain)
    if ((domain === 'plan' || domain === 'preferences' || domain === 'body') && isPending(domain)) return
    recordRevision(domain, data)
    if (domain === 'history') {
      const removed = new Set([...(getState()._pendingWorkoutDeletes || []), ...deletedWorkouts])
      replaceState(applyDomainState(getState(), domain, data.filter(record => !removed.has(record.workout?.id || record.session?.id))))
      return
    }
    if (isPending(domain)) return
    if (domain === 'plan' || domain === 'preferences' || domain === 'body') {
      bases.set(domain, wire(domain, data))
      replaceState({ ...getState(), _syncBases: Object.fromEntries(bases) })
    }
    if (initial && domain === 'body') {
      const local = getState()
      const missingWeights = !data.weights.length && local.bodyweight?.length
      const missingMeasurements = !data.measurements.length && local.bodyMeasurements?.length
      if (missingWeights || missingMeasurements) {
        const next = applyDomainState(local, domain, data)
        if (missingWeights) next.bodyweight = local.bodyweight
        if (missingMeasurements) next.bodyMeasurements = local.bodyMeasurements
        next._pendingSync = { ...next._pendingSync, body: true }
        replaceState(next)
        return
      }
    }
    replaceState(applyDomainState(getState(), domain, data))
  }

  function flushDomain(domain) {
    if (failures.get(domain) === 'sync-conflict') return Promise.resolve()
    if (inFlight.has(domain)) return inFlight.get(domain)
    const task = (async () => {
      let writes = 0
      while (writes++ < 8 && current() && isOnline() && isPending(domain)) {
        const state = getState()
        const sentFingerprint = domain === 'history' ? state._pendingWorkoutDeletes[0] : fingerprints[domain](state)
        let saved
        try { saved = await save(domain, state) }
        catch (error) {
          if (domain === 'plan' && error?.kind === 'selection-conflict') {
            if (!current()) break
            // A detached snapshot is not a writable journal: applying a personal
            // plan uses live server routines. Keep unsent edits in the durable
            // pending state until this selection conflict is explicitly resolved.
            const conflict = remote => ({ base: bases.get(domain) || null,
              local: inputFor(domain, getState()), remote, path: 'schedule.libraryId' })
            replaceState({ ...getState(), _syncConflicts: { ...getState()._syncConflicts, plan: conflict(null) } })
            failures.set(domain, 'sync-conflict')
            try {
              const remote = await repository.loadPlan()
              if (!current()) break
              replaceState({ ...getState(), _syncConflicts: { ...getState()._syncConflicts, plan: conflict(wire(domain, remote)) } })
            } catch { /* The local journal and conflict remain durable even if the read fails. */ }
            break
          }
          console.error('Account domain synchronization failed', domain, error)
          failures.set(domain, error?.kind || 'request-failed')
          if (error?.retryable && error?.kind !== 'revision-conflict' && (retryAttempts.get(domain) || 0) < 5 && isOnline() && !retryTimers.has(domain)) {
            const attempts = retryAttempts.get(domain) || 0
            const delay = Math.min(30000, 2000 * 2 ** attempts)
            retryAttempts.set(domain, attempts + 1)
            retryTimers.set(domain, setTimeout(() => {
              retryTimers.delete(domain)
              if (current()) void retry()
            }, delay))
          }
          break
        }
        if (!current()) break
        recordRevision(domain, saved)
        if (domain === 'plan' || domain === 'preferences' || domain === 'body') {
          onCommitted(domain, domain === 'plan' ? saved.schedule?.revision || 0 : saved.revision)
          bases.set(domain, wire(domain, saved))
          replaceState({ ...getState(), _syncBases: Object.fromEntries(bases) })
        }
        failures.delete(domain)
        if (getState()._syncConflicts?.[domain]) {
          const conflicts = { ...getState()._syncConflicts }; delete conflicts[domain]
          replaceState({ ...getState(), _syncConflicts: conflicts })
        }
        retryAttempts.delete(domain)
        if (retryTimers.has(domain)) { clearTimeout(retryTimers.get(domain)); retryTimers.delete(domain) }
        if (domain === 'history') {
          deletedWorkouts.add(sentFingerprint)
          const next = { ...getState(), _pendingWorkoutDeletes: (getState()._pendingWorkoutDeletes || []).filter(id => id !== sentFingerprint) }
          replaceState(next)
          continue
        }
        if (fingerprints[domain](getState()) !== sentFingerprint) {
          if (domain === 'plan' || domain === 'preferences' || domain === 'body') {
            const base = inputFor(domain, state), local = inputFor(domain, getState()), remote = wire(domain, saved)
            try {
              const merged = mergeChanges(base, local, remote)
              const data = domain === 'plan' ? { ...saved, routines: merged.routines, schedule: { ...saved.schedule, mode: merged.mode, values: merged.schedule } } : { ...saved, ...merged }
              replaceState(applyDomainState(getState(), domain, data))
            } catch (error) {
              replaceState({ ...getState(), _syncConflicts: { ...getState()._syncConflicts, [domain]: { base, local, remote, path: error.path || '' } } })
              failures.set(domain, 'sync-conflict')
              break
            }
          }
          continue
        }
        const next = applyDomainState(getState(), domain, saved)
        next._pendingSync = { ...next._pendingSync, [domain]: false }
        replaceState(next)
      }
    })()
    inFlight.set(domain, task)
    publish()
    return task.finally(() => { inFlight.delete(domain); if (current()) publish() })
  }

  function changed() {
    if (!started || !current()) return Promise.resolve()
    if (!isOnline()) { publish(); return Promise.resolve() }
    const domains = pending()
    if (!domains.length) { publish(); return Promise.resolve() }
    return Promise.all(domains.map(flushDomain))
  }

  function start() { started = true; return changed() }
  function retry() { failures.clear(); return changed() }
  function dispose() { disposed = true; retryTimers.forEach(timer => clearTimeout(timer)); retryTimers.clear() }

  return { acceptRemote, changed, start, retry, dispose, status, revision: domain => domain === 'plan' ? planRevision : domain === 'body' ? bodyRevision : preferenceRevision }
}
