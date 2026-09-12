// The persisted boundary for a finished session. Keep this pure so compatibility tests can
// exercise the exact shape the UI writes without mounting React or mutating store state.
export function buildCompletedWorkout(active, { end = Date.now(), prs = [], snapshotFor } = {}) {
  const start = active?.start || end
  const entries = (active?.entries || []).map(entry => {
    const completed = {
      id: entry.id,
      sets: entry.sets,
      topW: entry.topW || null,
      target: entry.target || null,
    }
    if (entry.sg) completed.sg = entry.sg
    if (entry.replacedFrom) completed.replacedFrom = entry.replacedFrom
    if (entry.replacedBy) completed.replacedBy = entry.replacedBy
    const snapshot = typeof snapshotFor === 'function' ? snapshotFor(entry) : null
    if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) && Object.keys(snapshot).length) {
      completed.muscleSnapshot = { ...snapshot }
    }
    return completed
  }).filter(entry => entry.sets.some(set => set.done))

  return {
    id: active.id,
    d: active.d,
    start,
    end,
    routineId: active.routineId,
    name: active.name,
    bw: active.bw,
    entries,
    prs,
  }
}
