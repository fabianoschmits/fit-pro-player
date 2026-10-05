import { buildNotificationSchedule, normalizeNotificationPreferences } from './notification-preferences.js'
import { bodyMeasurementWeekKey } from './body-measurements.js'
import { isoOf } from './format.js'

const MINUTE = 60000
const clockMinutes = time => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function afterQuietHours(dueAt, quiet) {
  if (!quiet.enabled || quiet.start === quiet.end) return dueAt
  const start = clockMinutes(quiet.start), end = clockMinutes(quiet.end)
  const date = new Date(dueAt)
  const minute = date.getHours() * 60 + date.getMinutes()
  const wraps = start > end
  if (!(wraps ? minute >= start || minute < end : minute >= start && minute < end)) return dueAt
  if (wraps && minute >= start) date.setDate(date.getDate() + 1)
  date.setHours(Math.floor(end / 60), end % 60, 0, 0)
  return date.getTime()
}

// Pure local planning also works for guests and devices without a background subscription.
export function nextForegroundReminders(S = {}, nowDate = new Date()) {
  const now = new Date(nowDate).getTime()
  if (!Number.isFinite(now)) return []
  const preferences = normalizeNotificationPreferences(S.notifications, S.reminder)
  const schedule = buildNotificationSchedule(S, nowDate)
  const yesterday = new Date(nowDate)
  yesterday.setDate(yesterday.getDate() - 1)
  const previous = buildNotificationSchedule(S, yesterday)
  const horizon = new Date(nowDate)
  horizon.setDate(horizon.getDate() + 13)
  const horizonDate = isoOf(horizon)
  // A quiet-hours deferral can still be due today after a page reload at midnight.
  const plan = { [isoOf(yesterday)]: previous.dayPlan[isoOf(yesterday)], ...Object.fromEntries(Object.entries(schedule.dayPlan).filter(([date]) => date <= horizonDate)) }
  const completed = new Set([...previous.completedDates, ...schedule.completedDates])
  const weightWeeks = new Set([...previous.weightDates, ...schedule.weightDates].map(bodyMeasurementWeekKey))
  const measurementWeeks = new Set([...previous.measurementWeeks, ...schedule.measurementWeeks])
  const usableRoutines = new Set(schedule.routines.filter(routine => routine.hasExercises).map(routine => routine.id))
  const events = []
  const add = (kind, identity, deadline, expiresAt) => {
    const dueAt = afterQuietHours(deadline, preferences.quietHours)
    if (dueAt >= now - 5 * MINUTE && dueAt < expiresAt) events.push({ id: `${kind}:${identity}`, kind, dueAt })
  }
  for (const [date, routineId] of Object.entries(plan)) {
    if (preferences.workoutReminder && usableRoutines.has(routineId) && !completed.has(date) && schedule.activeDate !== date) {
      const trainingAt = new Date(`${date}T${preferences.trainingTime}:00`).getTime()
      add('workout_reminder', date, trainingAt - preferences.leadMinutes * MINUTE, trainingAt + 30 * MINUTE)
    }
    const day = new Date(`${date}T12:00:00`)
    if (day.getDay() !== preferences.checkinDay) continue
    const week = bodyMeasurementWeekKey(date)
    const checkinAt = new Date(`${date}T${preferences.checkinTime}:00`).getTime()
    const expiresAt = checkinAt + 12 * 60 * MINUTE
    if (preferences.weightReminder && !weightWeeks.has(week)) add('weight_reminder', week, checkinAt, expiresAt)
    if (preferences.measurementReminder && !measurementWeeks.has(week)) add('measurement_reminder', week, checkinAt, expiresAt)
  }
  return events.sort((a, b) => a.dueAt - b.dueAt || a.id.localeCompare(b.id))
}
