import { isoOf } from './format.js'
import { effectiveRoutineId } from './history.js'
import { bodyMeasurementWeekKey, normalizeBodyMeasurementCheckins } from './body-measurements.js'

export const DEFAULT_NOTIFICATION_PREFERENCES = Object.freeze({
  rest: true, timedSet: true, workoutReminder: false, professional: true,
  weightReminder: false, measurementReminder: false, trainingTime: '18:00',
  leadMinutes: 120, checkinDay: 0, checkinTime: '09:00',
  quietHours: Object.freeze({ enabled: false, start: '22:00', end: '07:00' }),
})

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const validTime = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const leads = new Set([0, 15, 30, 60, 120, 180, 360])
const booleanKeys = ['rest', 'timedSet', 'workoutReminder', 'professional', 'weightReminder', 'measurementReminder']

export function normalizeNotificationPreferences(raw, legacyReminder) {
  const source = object(raw)
  const defaults = DEFAULT_NOTIFICATION_PREFERENCES
  const next = { ...defaults }
  for (const key of booleanKeys) next[key] = typeof source[key] === 'boolean' ? source[key] : defaults[key]
  next.trainingTime = validTime(source.trainingTime) ? source.trainingTime : defaults.trainingTime
  next.leadMinutes = leads.has(source.leadMinutes) ? source.leadMinutes : defaults.leadMinutes
  next.checkinDay = Number.isInteger(source.checkinDay) && source.checkinDay >= 0 && source.checkinDay <= 6 ? source.checkinDay : defaults.checkinDay
  next.checkinTime = validTime(source.checkinTime) ? source.checkinTime : defaults.checkinTime
  const quiet = object(source.quietHours)
  next.quietHours = {
    enabled: typeof quiet.enabled === 'boolean' ? quiet.enabled : defaults.quietHours.enabled,
    start: validTime(quiet.start) ? quiet.start : defaults.quietHours.start,
    end: validTime(quiet.end) ? quiet.end : defaults.quietHours.end,
  }
  // Legacy time was the notification clock, rather than the training clock.
  if (raw == null && legacyReminder && typeof legacyReminder === 'object') {
    next.workoutReminder = legacyReminder.on === true
    if (validTime(legacyReminder.time)) {
      const [hour, minute] = legacyReminder.time.split(':').map(Number)
      const training = (hour * 60 + minute + next.leadMinutes) % 1440
      next.trainingTime = `${String(Math.floor(training / 60)).padStart(2, '0')}:${String(training % 60).padStart(2, '0')}`
    }
  }
  return next
}

const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && isoOf(new Date(`${value}T12:00:00`)) === value
const dates = (values, start, end) => [...new Set(values.filter(value => validDate(value) && value >= start && value <= end))].sort()

// Only calendar metadata reaches the reminder queue; body values and workout entries stay local.
export function buildNotificationSchedule(S = {}, nowDate = new Date()) {
  const first = new Date(nowDate)
  first.setHours(12, 0, 0, 0)
  const start = isoOf(first)
  const last = new Date(first)
  last.setDate(last.getDate() + 13)
  const end = isoOf(last)
  const periodStart = bodyMeasurementWeekKey(start)
  const routines = (Array.isArray(S.routines) ? S.routines : []).filter(routine => typeof routine?.id === 'string' && routine.id && routine.id.length <= 256).slice(0, 2000)
    .map(routine => ({ id: routine.id, hasExercises: Array.isArray(routine.ex) && routine.ex.length > 0 }))
  const ids = new Set(routines.map(routine => routine.id))
  const week = Object.fromEntries(Object.entries(object(S.week)).filter(([day, id]) => /^[0-6]$/.test(day) && ids.has(id)))
  const planMode = S.planMode === 'daily' ? 'daily' : 'weekly'
  const dayPlan = {}
  for (let offset = 0; offset < 14; offset++) {
    const day = new Date(first)
    day.setDate(day.getDate() + offset)
    const date = isoOf(day)
    const routineId = effectiveRoutineId({ ...S, planMode, week, routines }, date)
    dayPlan[date] = ids.has(routineId) ? routineId : 'rest'
  }
  const futureLimit = new Date(first)
  futureLimit.setDate(futureLimit.getDate() + 365)
  const futureEnd = isoOf(futureLimit)
  for (const [date, routineId] of Object.entries(object(S.dayPlan))) {
    if (validDate(date) && date >= start && date <= futureEnd && (routineId === 'rest' || ids.has(routineId))) dayPlan[date] = routineId
  }
  return {
    planMode, week, dayPlan, routines,
    completedDates: dates((Array.isArray(S.workouts) ? S.workouts : []).map(workout => workout?.d), start, end),
    activeDate: validDate(S.active?.d) ? S.active.d : null,
    weightDates: dates((Array.isArray(S.bodyweight) ? S.bodyweight : []).map(record => record?.d), periodStart, end),
    measurementWeeks: [...new Set(normalizeBodyMeasurementCheckins(S.bodyMeasurements)
      .filter(record => Object.keys(record.values).length && record.date >= periodStart && record.date <= end)
      .map(record => record.week))].sort(),
  }
}
