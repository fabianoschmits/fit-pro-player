const timestamp = value => {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

const cloneRecord = value => value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {}

/** Converts validated domain DTOs to the existing UI state shape at one boundary. */
export function applyDomainState(state, domain, data) {
  const next = { ...state }
  if (domain === 'preferences') {
    Object.assign(next, cloneRecord(data.values), { displayUnit: data.displayUnit, massUnit: data.massUnit })
    return next
  }
  if (domain === 'plan') {
    const revision = data.schedule?.revision || 0
    if (revision < (state.planServerRevision || 0)) return state
    next.planServerRevision = revision
    next.routines = data.routines.map(routine => ({ ...cloneRecord(routine.prescription), id: routine.id, name: routine.title }))
    next.planMode = data.schedule?.mode || 'weekly'
    next.week = cloneRecord(data.schedule?.values?.week)
    next.dayPlan = cloneRecord(data.schedule?.values?.dayPlan)
    next.activeLibraryId = data.schedule?.values?.libraryId || null
    next.activeLibraryTitle = data.schedule?.values?.libraryTitle || null
    next.assignedProgram = data.schedule?.values?.assignedProgram || null
    return next
  }
  if (domain === 'body') {
    next.bodyweight = data.weights.map(entry => ({ id: entry.id, d: entry.date, w: entry.weightKg, t: timestamp(entry.date) }))
    next.bodyMeasurements = data.measurements.map(entry => ({ id: entry.id, date: entry.date, values: { ...entry.valuesCm }, ...(entry.note ? { notes: entry.note } : {}), createdAt: timestamp(entry.createdAt), updatedAt: timestamp(entry.updatedAt) }))
    return next
  }
  if (domain === 'history') {
    next.workouts = data.flatMap(record => record.workout ? [{ ...record.workout }] : [])
      .sort((left, right) => String(left.d || '').localeCompare(String(right.d || '')) || Number(left.start || 0) - Number(right.start || 0))
    return next
  }
  throw new TypeError('unknown-domain-state')
}
