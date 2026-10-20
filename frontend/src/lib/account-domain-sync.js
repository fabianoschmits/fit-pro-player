import { applyDomainState } from './domain-state.js'
import { bodyFingerprint, planFingerprint, preferenceFingerprint, preferenceValues } from './domain-sync-state.js'

const DOMAINS = ['plan', 'body', 'preferences', 'history']
const fingerprints = { plan: planFingerprint, body: bodyFingerprint, preferences: preferenceFingerprint }
const validId = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')
const idOf = value => validId(value) ? value : crypto.randomUUID()

/** Sends account changes immediately when connected. Local state is the durable pending journal. */
export function createAccountDomainSync({ repository, getState, replaceState, isCurrent, isOnline, onStatus = () => {} }) {
  let started = false
  let disposed = false
  let planRevision = 0
  let preferenceRevision = 0
  const failures = new Map()
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

  async function save(domain, state) {
    if (domain === 'history') return repository.deleteCompletedWorkout({ sessionId: state._pendingWorkoutDeletes[0] })
    if (domain === 'body') return repository.saveBody({
      weights: state.bodyweight.map(entry => ({ id: idOf(entry.id), date: entry.d, weightKg: entry.w })),
      measurements: state.bodyMeasurements.map(entry => ({ id: idOf(entry.id), date: entry.date, valuesCm: entry.values || {}, note: entry.notes || '' })),
    })
    if (domain === 'plan') {
      const input = {
        mode: state.planMode, schedule: { week: state.week, dayPlan: state.dayPlan },
        routines: state.routines.map(({ id, name, ...prescription }) => ({ id, title: name || 'Routine', prescription })),
      }
      try { return await repository.savePlan({ ...input, expectedRevision: planRevision }) }
      catch (error) {
        if (error?.kind !== 'revision-conflict') throw error
        const fresh = await repository.loadPlan()
        planRevision = fresh.schedule?.revision || 0
        return repository.savePlan({ ...input, expectedRevision: planRevision })
      }
    }
    const input = { displayUnit: state.displayUnit, values: preferenceValues(state) }
    try { return await repository.savePreferences({ ...input, expectedRevision: preferenceRevision }) }
    catch (error) {
      if (error?.kind !== 'revision-conflict') throw error
      const fresh = await repository.loadPreferences()
      preferenceRevision = fresh.revision
      return repository.savePreferences({ ...input, expectedRevision: preferenceRevision })
    }
  }

  function recordRevision(domain, data) {
    if (domain === 'plan') planRevision = data.schedule?.revision || 0
    if (domain === 'preferences') preferenceRevision = data.revision || 0
  }

  function acceptRemote(domain, data) {
    if (!current()) return
    const initial = firstRead.delete(domain)
    recordRevision(domain, data)
    if (domain === 'history') {
      const removed = new Set([...(getState()._pendingWorkoutDeletes || []), ...deletedWorkouts])
      replaceState(applyDomainState(getState(), domain, data.filter(record => !removed.has(record.workout?.id || record.session?.id))))
      return
    }
    if (isPending(domain)) return
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
    if (inFlight.has(domain)) return inFlight.get(domain)
    const task = (async () => {
      while (current() && isOnline() && isPending(domain)) {
        const state = getState()
        const sentFingerprint = domain === 'history' ? state._pendingWorkoutDeletes[0] : fingerprints[domain](state)
        let saved
        try { saved = await save(domain, state) }
        catch (error) {
          failures.set(domain, error?.kind || 'request-failed')
          if (error?.retryable && isOnline() && !retryTimers.has(domain)) {
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
        failures.delete(domain)
        retryAttempts.delete(domain)
        if (retryTimers.has(domain)) { clearTimeout(retryTimers.get(domain)); retryTimers.delete(domain) }
        if (domain === 'history') {
          deletedWorkouts.add(sentFingerprint)
          const next = { ...getState(), _pendingWorkoutDeletes: (getState()._pendingWorkoutDeletes || []).filter(id => id !== sentFingerprint) }
          replaceState(next)
          continue
        }
        if (fingerprints[domain](getState()) !== sentFingerprint) continue
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

  return { acceptRemote, changed, start, retry, dispose, status }
}
