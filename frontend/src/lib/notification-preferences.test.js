// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { normalizeState } from '../store/useStore.js'
import { normalizeNotificationPreferences as normalize, buildNotificationSchedule as schedule } from './notification-preferences.js'

describe('notification preferences', () => {
  it('defaults to local timer and professional alerts with optional reminders off', () => {
    expect(normalize()).toEqual({
      rest: true, timedSet: true, workoutReminder: false, professional: true,
      weightReminder: false, measurementReminder: false, trainingTime: '18:00',
      leadMinutes: 120, checkinDay: 0, checkinTime: '09:00',
      quietHours: { enabled: false, start: '22:00', end: '07:00' },
    })
  })

  it('preserves the legacy delivery clock when introducing the two-hour lead', () => {
    expect(normalize(undefined, { on: true, time: '23:30' })).toMatchObject({
      workoutReminder: true, trainingTime: '01:30', leadMinutes: 120,
    })
    expect(normalize({ workoutReminder: false, trainingTime: '18:15', leadMinutes: 30 }, { on: true, time: '08:00' }))
      .toMatchObject({ workoutReminder: false, trainingTime: '18:15', leadMinutes: 30 })
    expect(normalize(undefined, { on: false, time: '06:45' }))
      .toMatchObject({ workoutReminder: false, trainingTime: '08:45', leadMinutes: 120 })
  })

  it('repairs malformed values and drops unsupported preference fields', () => {
    expect(normalize({
      rest: 'false', timedSet: false, professional: null, weightReminder: true,
      trainingTime: '25:60', leadMinutes: 121, checkinDay: 7, checkinTime: '9:00',
      quietHours: { enabled: 'yes', start: '99:00', end: '23:59' }, marketing: true,
    })).toEqual({
      rest: true, timedSet: false, workoutReminder: false, professional: true,
      weightReminder: true, measurementReminder: false, trainingTime: '18:00',
      leadMinutes: 120, checkinDay: 0, checkinTime: '09:00',
      quietHours: { enabled: false, start: '22:00', end: '23:59' },
    })
  })

  it('returns independent nested preferences and accepts every approved lead', () => {
    const first = normalize()
    if (first) first.quietHours.start = '12:00'
    expect(normalize()?.quietHours.start).toBe('22:00')
    for (const leadMinutes of [0, 15, 30, 60, 120, 180, 360]) {
      expect(normalize({ leadMinutes })?.leadMinutes).toBe(leadMinutes)
    }
  })

  it('normalizes imported state without enabling a legacy reminder by default', () => {
    expect(normalizeState({ routines: [], workouts: [] }).notifications).toEqual(normalize())
    expect(normalizeState({ reminder: { on: true, time: '08:00' } }).notifications)
      .toMatchObject({ workoutReminder: true, trainingTime: '10:00', leadMinutes: 120 })
  })
})

describe('notification schedule snapshot', () => {
  const now = new Date(2026, 9, 4, 23, 58)
  const S = {
    planMode: 'weekly', week: { 0: 'a', 1: 'b', 7: 'a' },
    dayPlan: { '2026-10-05': 'rest', '2026-10-06': 'a', '2026-10-07': 'missing', '2030-01-01': 'a' },
    routines: [{ id: 'a', name: 'A', ex: [{ id: 'e1' }] }, { id: 'b', name: 'Empty', ex: [] }],
    workouts: [{ d: '2026-10-04' }, { d: '2026-10-04' }, { d: '2020-01-01' }],
    active: { d: '2026-10-06', entries: [] },
    bodyweight: [{ d: '2026-09-28', w: 70 }, { d: '2026-10-04', w: 71 }, { d: 'bad', w: 72 }],
    bodyMeasurements: [{ date: '2026-10-01', values: { chest: 100 } }, { date: '2026-10-04', values: { waist: 88 } }, { date: 'bad', values: { waist: 88 } }],
  }

  it('bounds the next fourteen dates and resolves overrides, rest and weekly fallback', () => {
    const result = schedule(S, now)
    expect(result?.planMode).toBe('weekly')
    expect(result?.week).toEqual({ 0: 'a', 1: 'b' })
    expect(Object.keys(result?.dayPlan || {})).toHaveLength(14)
    expect(result?.dayPlan).toMatchObject({ '2026-10-04': 'a', '2026-10-05': 'rest', '2026-10-06': 'a', '2026-10-07': 'rest', '2026-10-11': 'a', '2026-10-12': 'b', '2026-10-17': 'rest' })
    expect(result?.dayPlan).not.toHaveProperty('2030-01-01')
    expect(result?.routines).toEqual([{ id: 'a', hasExercises: true }, { id: 'b', hasExercises: false }])
  })

  it('uses local day stamps and existing Monday measurement periods', () => {
    const result = schedule(S, now)
    expect(Object.keys(result?.dayPlan || {})[0]).toBe('2026-10-04')
    expect(result?.completedDates).toEqual(['2026-10-04'])
    expect(result?.activeDate).toBe('2026-10-06')
    expect(result?.weightDates).toEqual(['2026-09-28', '2026-10-04'])
    expect(result?.measurementWeeks).toEqual(['2026-09-28'])
  })

  it('does not inherit weekly routines in date mode or leak workout contents', () => {
    const result = schedule({ ...S, planMode: 'daily' }, now)
    expect(result?.dayPlan).toMatchObject({ '2026-10-04': 'rest', '2026-10-05': 'rest', '2026-10-06': 'a', '2026-10-12': 'rest' })
    expect(Object.keys(result || {})).toEqual(['planMode', 'week', 'dayPlan', 'routines', 'completedDates', 'activeDate', 'weightDates', 'measurementWeeks'])
  })

  it('preserves explicit future overrides for daily server refill within a one-year bound', () => {
    const result = schedule({ ...S, dayPlan: {
      '2026-10-24': 'rest', '2026-10-25': 'a', '2026-10-26': 'missing',
      '2027-10-04': 'b', '2027-10-05': 'a', '2026-02-30': 'a',
    } }, now)
    expect(result.dayPlan).toMatchObject({ '2026-10-24': 'rest', '2026-10-25': 'a', '2027-10-04': 'b' })
    expect(result.dayPlan).not.toHaveProperty('2026-10-26')
    expect(result.dayPlan).not.toHaveProperty('2027-10-05')
    expect(result.dayPlan).not.toHaveProperty('2026-02-30')
    expect(Object.keys(result.dayPlan)).toHaveLength(17)
    const daily = schedule({ ...S, planMode: 'daily', dayPlan: { '2026-10-24': 'a' } }, now)
    expect(daily.dayPlan['2026-10-24']).toBe('a')
  })
})
