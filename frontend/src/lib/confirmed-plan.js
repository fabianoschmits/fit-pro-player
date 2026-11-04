import { applyDomainState } from './domain-state.js'
import { mergeChanges } from './three-way-merge.js'

export const planWire = state => ({
  mode: state.planMode,
  schedule: { week: state.week, dayPlan: state.dayPlan, ...(state.assignedProgram ? { assignedProgram: state.assignedProgram } : {}), ...(state.activeLibraryId ? { libraryId: state.activeLibraryId, libraryTitle: state.activeLibraryTitle } : {}) },
  routines: state.routines.map(({ id, name, ...prescription }) => ({ id, title: name ?? 'Routine', prescription })),
})

/** A confirmed write owns execution; concurrent personal changes remain a durable journal. */
export function confirmedPlanState(state, data, base = state, cached = undefined) {
  if ((data.schedule?.revision || 0) < (state.planServerRevision || 0)) return state
  let peerConflict = null
  if (cached?._pendingSync?.plan) {
    const personal = value => value.routines.filter(row => !row.assigned)
    const original = state
    try {
      const routines = mergeChanges(personal(base), personal(state), personal(cached))
      state = { ...state, routines: [...state.routines.filter(row => row.assigned), ...routines], _pendingSync: { ...state._pendingSync, plan: true }, _ts: Math.max(state._ts || 0, cached._ts || 0) }
    } catch (error) {
      peerConflict = { base: planWire(base), local: planWire(original), otherTab: planWire(cached), path: error.path || 'routines' }
    }
    if (JSON.stringify([base.planMode,base.week,base.dayPlan]) !== JSON.stringify([cached.planMode,cached.week,cached.dayPlan])) {
      peerConflict ||= { base: planWire(base), local: planWire(original), otherTab: planWire(cached), path: 'schedule' }
    }
  }
  const next = applyDomainState(state, 'plan', data)
  const remote = { mode: data.schedule?.mode || 'weekly', schedule: data.schedule?.values || {}, routines: data.routines.map(({ id, title, prescription }) => ({ id, title, prescription })) }
  const personal = value => value.routines.filter(row => !row.assigned)
  const previous = personal(base), local = personal(state), received = personal(next)
  let conflict = peerConflict ? { ...peerConflict, remote } : null
  if (JSON.stringify(previous) !== JSON.stringify(local)) {
    try { next.routines = [...next.routines.filter(row => row.assigned), ...mergeChanges(previous, local, received)] }
    catch (error) {
      // Keep both sides in recovery, and keep the user's edited personal routines usable.
      conflict = { base: planWire(base), local: planWire(state), remote, otherTab: undefined, path: error.path || 'routines' }
      const ids = new Set(local.map(row => row.id))
      next.routines = [...next.routines.filter(row => row.assigned), ...local, ...received.filter(row => !ids.has(row.id))]
    }
  }
  const schedule = value => JSON.stringify([value.planMode, value.week, value.dayPlan])
  if (state._pendingSync?.plan && schedule(base) !== schedule(state)) {
    conflict ||= { base: planWire(base), local: planWire(state), remote, otherTab: undefined, path: 'schedule' }
  }
  const dirty = JSON.stringify(personal(next)) !== JSON.stringify(received)
  const conflicts = { ...state._syncConflicts }; delete conflicts.plan
  if (conflict) conflicts.plan = conflict
  next._syncConflicts = conflicts
  next._syncBases = { ...state._syncBases, plan: remote }
  next._pendingSync = { ...state._pendingSync, plan: dirty || !!conflict }
  return next
}
