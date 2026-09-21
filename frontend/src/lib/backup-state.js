export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value)

function rejectUnsafeKeys(root) {
  const pending = [root]
  while (pending.length) {
    const value = pending.pop()
    if (!value || typeof value !== 'object') continue
    for (const key of Object.keys(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new Error('backup contains an unsafe property')
      }
      pending.push(value[key])
    }
  }
}

function validEntries(entries) {
  return Array.isArray(entries) && entries.every(entry =>
    isObject(entry) && typeof entry.id === 'string' && entry.id.length > 0
    && Array.isArray(entry.sets) && entry.sets.every(isObject))
}

export function validateBackup(data) {
  if (!isObject(data)) throw new Error('not a Fit Pro Player backup')
  rejectUnsafeKeys(data)
  if (!Array.isArray(data.routines) || !Array.isArray(data.workouts)) {
    throw new Error('not a Fit Pro Player backup')
  }
  if (!data.routines.every(routine => isObject(routine) && Array.isArray(routine.ex)
    && routine.ex.every(entry => isObject(entry) && typeof entry.id === 'string' && entry.id.length > 0))) {
    throw new Error('backup contains an invalid routine')
  }
  if (!data.workouts.every(workout => isObject(workout) && validEntries(workout.entries))) {
    throw new Error('backup contains an invalid workout')
  }
  if (data.active != null && (!isObject(data.active) || !validEntries(data.active.entries))) {
    throw new Error('backup contains an invalid active workout')
  }
  if (data.bodyweight != null && (!Array.isArray(data.bodyweight) || !data.bodyweight.every(item =>
    isObject(item) && typeof item.d === 'string' && Number.isFinite(Number(item.w)) && Number(item.w) > 0))) {
    throw new Error('backup contains invalid body weight data')
  }
  for (const key of ['bodyMeasurements', 'customEx']) {
    if (data[key] != null && (!Array.isArray(data[key]) || !data[key].every(isObject))) {
      throw new Error(`backup contains invalid ${key}`)
    }
  }
  for (const key of ['bodyMeasurementGoals', 'week', 'dayPlan', 'exWeights', 'profile', 'reminder']) {
    if (data[key] != null && !isObject(data[key])) throw new Error(`backup contains invalid ${key}`)
  }
  return data
}
