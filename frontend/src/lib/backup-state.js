export const MAX_BACKUP_BYTES = 5 * 1024 * 1024

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value)

function rejectUnsafeKeys(root) {
  const pending = [[root, 0]]
  const seen = new Set()
  let count = 0
  while (pending.length) {
    const [value, depth] = pending.pop()
    if (depth > 24 || ++count > 200000) throw new Error('backup exceeds structure limits')
    if (typeof value === 'string' && value.length > 32768) throw new Error('backup text is too long')
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('backup contains an invalid number')
    if (!value || typeof value !== 'object') continue
    if (seen.has(value)) throw new Error('backup contains a cycle')
    seen.add(value)
    if (Array.isArray(value) && value.length > 20000) throw new Error('backup collection is too large')
    for (const key of Object.keys(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new Error('backup contains an unsafe property')
      }
      pending.push([value[key], depth + 1])
    }
  }
}

const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 256
function bounded(value, min, max) { return value == null || typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max }
function validSet(set) {
  return isObject(set) && bounded(set.w, 0, 10000) && bounded(set.r, 0, 10000)
    && bounded(set.reps, 0, 10000) && bounded(set.rir, 0, 100) && bounded(set.rpe, 0, 10)
    && bounded(set.dur, 0, 604800) && (set.done == null || typeof set.done === 'boolean')
}

function validEntries(entries) {
  return Array.isArray(entries) && entries.every(entry =>
    isObject(entry) && identifier(entry.id)
    && Array.isArray(entry.sets) && entry.sets.length <= 200 && entry.sets.every(validSet))
}

function validNotificationPreferences(value) {
  if (!isObject(value)) return false
  const has = key => Object.prototype.hasOwnProperty.call(value, key)
  for (const key of ['rest', 'timedSet', 'workoutReminder', 'professional', 'weightReminder', 'measurementReminder']) {
    if (has(key) && typeof value[key] !== 'boolean') return false
  }
  const time = raw => typeof raw === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw)
  for (const key of ['trainingTime', 'checkinTime']) if (has(key) && !time(value[key])) return false
  if (has('leadMinutes') && ![0, 15, 30, 60, 120, 180, 360].includes(value.leadMinutes)) return false
  if (has('checkinDay') && !(Number.isInteger(value.checkinDay) && value.checkinDay >= 0 && value.checkinDay <= 6)) return false
  if (has('quietHours')) {
    if (!isObject(value.quietHours)) return false
    for (const [key, raw] of Object.entries(value.quietHours)) {
      if (key === 'enabled' && typeof raw !== 'boolean') return false
      if ((key === 'start' || key === 'end') && !time(raw)) return false
    }
  }
  return true
}

export function validateBackup(data) {
  if (!isObject(data)) throw new Error('not a Fit Pro Player backup')
  rejectUnsafeKeys(data)
  if (new TextEncoder().encode(JSON.stringify(data)).length > MAX_BACKUP_BYTES) throw new Error('backup is larger than 5 MB')
  if (!Array.isArray(data.routines) || !Array.isArray(data.workouts)) {
    throw new Error('not a Fit Pro Player backup')
  }
  if (data.routines.length > 2000 || !data.routines.every(routine => isObject(routine) && identifier(routine.id) && Array.isArray(routine.ex) && routine.ex.length <= 200
    && routine.ex.every(entry => isObject(entry) && identifier(entry.id)
      && bounded(entry.reps, 0, 10000) && bounded(entry.rest, 0, 86400)
      && (entry.sets == null || Array.isArray(entry.sets) ? entry.sets == null || entry.sets.length <= 200 && entry.sets.every(validSet) : bounded(entry.sets, 1, 200))))) {
    throw new Error('backup contains an invalid routine')
  }
  if (!data.workouts.every(workout => isObject(workout) && identifier(workout.id) && (workout.d == null || validDate(workout.d)) && validEntries(workout.entries))) {
    throw new Error('backup contains an invalid workout')
  }
  if (data.active != null && (!isObject(data.active) || !validEntries(data.active.entries))) {
    throw new Error('backup contains an invalid active workout')
  }
  if (data.bodyweight != null && (!Array.isArray(data.bodyweight) || !data.bodyweight.every(item =>
    isObject(item) && validDate(item.d) && bounded(item.w, 0.1, 1000) && item.w != null))) {
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
  if (Object.prototype.hasOwnProperty.call(data, 'notifications') && !validNotificationPreferences(data.notifications)) throw new Error('backup contains invalid notification preferences')
  if (!bounded(data.restSec, 0, 86400) || !bounded(data.targetW, 0.1, 1000) || !bounded(data._ts, 0, Number.MAX_SAFE_INTEGER)) throw new Error('backup contains invalid settings')
  if (data.week && !Object.entries(data.week).every(([key, value]) => /^[0-6]$/.test(key) && (value == null || identifier(value)))) throw new Error('backup contains an invalid weekly plan')
  if (data.dayPlan && !Object.entries(data.dayPlan).every(([key, value]) => validDate(key) && (value == null || identifier(value)))) throw new Error('backup contains an invalid daily plan')
  if (data.profile?.name != null && (typeof data.profile.name !== 'string' || data.profile.name.length > 200)) throw new Error('backup contains an invalid profile')
  if (data.customEx && !data.customEx.every(item => identifier(item.id) && typeof item.name === 'string' && item.name.length <= 200)) throw new Error('backup contains an invalid custom exercise')
  if (data.pendingProfessionalEvents != null && (!Array.isArray(data.pendingProfessionalEvents) || data.pendingProfessionalEvents.length > 2000 || !data.pendingProfessionalEvents.every(isObject))) throw new Error('backup contains an invalid event queue')
  return data
}
