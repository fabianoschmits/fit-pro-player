import { describe, expect, it } from 'vitest'
import { normalizeNotificationPreferences } from './notification-preferences.js'
import { nextForegroundReminders as reminders } from './foreground-reminders.js'
const local = (date, time) => new Date(`${date}T${time}:00`)
const state = patch => ({
  notifications: normalizeNotificationPreferences({ workoutReminder: true }),
  routines: [{ id: 'r1', name: 'Workout', ex: [{ id: 'e1' }] }],
  week: { 1: 'r1' }, dayPlan: {}, workouts: [], bodyweight: [], bodyMeasurements: [],
  ...patch,
})

describe('foreground reminders', () => {
  it('calculates a two-hour lead and returns stable generic events in deadline order', () => {
    const result = reminders(state(), local('2026-10-05', '15:55'))
    expect(result).toEqual([
      { id: 'workout_reminder:2026-10-05', kind: 'workout_reminder', dueAt: local('2026-10-05', '16:00').getTime() },
      { id: 'workout_reminder:2026-10-12', kind: 'workout_reminder', dueAt: local('2026-10-12', '16:00').getTime() },
    ])
  })

  it('moves the lead into the previous local day without changing the planned-date identity', () => {
    const result = reminders(state({ notifications: normalizeNotificationPreferences({ workoutReminder: true, trainingTime: '01:00' }) }), local('2026-10-04', '23:00'))
    expect(result?.[0]).toEqual({ id: 'workout_reminder:2026-10-05', kind: 'workout_reminder', dueAt: local('2026-10-04', '23:00').getTime() })
  })

  it.each([
    { dayPlan: { '2026-10-05': 'rest' } },
    { active: { d: '2026-10-05' } },
    { workouts: [{ d: '2026-10-05' }] },
    { routines: [{ id: 'r1', name: 'Empty', ex: [] }] },
    { planMode: 'daily' },
  ])('cancels a reminder when its training no longer qualifies: %j', patch => {
    expect(reminders(state(patch), local('2026-10-05', '15:55'))?.some(event => event.id === 'workout_reminder:2026-10-05')).toBe(false)
  })

  it('uses Monday periods for weight and measurements while keeping their choices independent', () => {
    const S = state({
      notifications: normalizeNotificationPreferences({ weightReminder: true, measurementReminder: true, checkinDay: 1 }),
      bodyweight: [{ d: '2026-10-07', w: 80 }],
      bodyMeasurements: [{ date: '2026-10-01', values: { chest: 100 } }],
    })
    const result = reminders(S, local('2026-10-05', '08:00'))
    expect(result).toEqual([
      { id: 'measurement_reminder:2026-10-05', kind: 'measurement_reminder', dueAt: local('2026-10-05', '09:00').getTime() },
      { id: 'measurement_reminder:2026-10-12', kind: 'measurement_reminder', dueAt: local('2026-10-12', '09:00').getTime() },
      { id: 'weight_reminder:2026-10-12', kind: 'weight_reminder', dueAt: local('2026-10-12', '09:00').getTime() },
    ])
    S.bodyMeasurements.push({ date: '2026-10-08', values: { waist: 88 } })
    expect(reminders(S, local('2026-10-05', '08:00'))?.some(event => event.id === 'measurement_reminder:2026-10-05')).toBe(false)
  })

  it('suppresses the current Sunday check-in after a record in the preceding Monday period', () => {
    const S = state({ notifications: normalizeNotificationPreferences({ weightReminder: true, measurementReminder: true }), bodyweight: [{ d: '2026-09-28', w: 80 }], bodyMeasurements: [{ date: '2026-10-01', values: { chest: 100 } }] })
    expect(reminders(S, local('2026-10-04', '08:00'))?.map(event => event.id)).toEqual(['measurement_reminder:2026-10-05', 'weight_reminder:2026-10-05'])
  })

  it('shifts cross-midnight quiet reminders to the local quiet end and drops ones after training expiry', () => {
    const S = state({ notifications: normalizeNotificationPreferences({ workoutReminder: true, trainingTime: '08:00', quietHours: { enabled: true, start: '22:00', end: '07:00' } }) })
    expect(reminders(S, local('2026-10-05', '00:30'))?.[0].dueAt).toBe(local('2026-10-05', '07:00').getTime())
    S.notifications.trainingTime = '01:00'
    expect(reminders(S, local('2026-10-04', '22:00'))).toEqual([])
  })

  it('shifts check-ins after quiet hours into the next day while preserving their week identity', () => {
    const S = state({ notifications: normalizeNotificationPreferences({ weightReminder: true, checkinDay: 0, checkinTime: '23:00', quietHours: { enabled: true, start: '22:00', end: '07:00' } }) })
    expect(reminders(S, local('2026-10-04', '22:00'))?.[0]).toEqual({ id: 'weight_reminder:2026-09-28', kind: 'weight_reminder', dueAt: local('2026-10-05', '07:00').getTime() })
  })

  it('retains a valid quiet-hours deferral when the app reopens on the following day', () => {
    const S = state({ notifications: normalizeNotificationPreferences({ weightReminder: true, checkinDay: 0, checkinTime: '23:00', quietHours: { enabled: true, start: '22:00', end: '07:00' } }) })
    expect(reminders(S, local('2026-10-05', '06:00'))?.[0]).toEqual({ id: 'weight_reminder:2026-09-28', kind: 'weight_reminder', dueAt: local('2026-10-05', '07:00').getTime() })
    S.bodyweight = [{ d: '2026-10-01', w: 80 }]
    expect(reminders(S, local('2026-10-05', '06:00'))?.some(event => event.id === 'weight_reminder:2026-09-28')).toBe(false)
  })

  it('treats daytime quiet end as exclusive and equal start/end as no interval', () => {
    const S = state({ notifications: normalizeNotificationPreferences({ weightReminder: true, checkinDay: 1, checkinTime: '09:00', quietHours: { enabled: true, start: '09:00', end: '10:00' } }) })
    expect(reminders(S, local('2026-10-05', '08:00'))?.[0].dueAt).toBe(local('2026-10-05', '10:00').getTime())
    S.notifications.checkinTime = '10:00'
    expect(reminders(S, local('2026-10-05', '08:00'))?.[0].dueAt).toBe(local('2026-10-05', '10:00').getTime())
    S.notifications.quietHours.end = '09:00'; S.notifications.checkinTime = '09:00'
    expect(reminders(S, local('2026-10-05', '08:00'))?.[0].dueAt).toBe(local('2026-10-05', '09:00').getTime())
  })

  it('does not resurrect deadlines more than five minutes old or disabled categories', () => {
    expect(reminders(state(), local('2026-10-05', '16:05'))?.[0].id).toBe('workout_reminder:2026-10-05')
    expect(reminders(state(), new Date('2026-10-05T16:05:01'))?.some(event => event.id === 'workout_reminder:2026-10-05')).toBe(false)
    expect(reminders(state({ notifications: normalizeNotificationPreferences() }), local('2026-10-05', '08:00'))).toEqual([])
  })

  it('keeps the foreground deadline window bounded despite server future-override metadata', () => {
    const S = state({ planMode: 'daily', dayPlan: { '2026-10-25': 'r1' } })
    expect(reminders(S, local('2026-10-05', '08:00'))).toEqual([])
    expect(reminders(S, local('2026-10-25', '08:00'))?.[0].id).toBe('workout_reminder:2026-10-25')
  })
})
