import { describe, expect, it } from 'vitest'
import { MAX_BACKUP_BYTES, validateBackup } from './backup-state.js'

const valid = () => ({
  routines: [{ id: 'r1', name: 'A', ex: [{ id: '0025', sets: 3, reps: 8 }] }],
  workouts: [{ id: 'w1', d: '2026-09-20', entries: [{ id: '0025', sets: [{ w: 60, r: 8, done: true }] }] }],
  bodyweight: [{ d: '2026-09-20', w: 80 }],
  week: {}, dayPlan: {}, exWeights: {}, profile: {}, reminder: {},
})

describe('backup validation', () => {
  it.each([
    { routines: [], workouts: [], restSec: -1 },
    { routines: [], workouts: [], workoutsInvalid: 'x', active: { entries: [{ id: 'x', sets: [{ w: -50, r: 10 }] }] } },
    { routines: [], workouts: [], dayPlan: { 'not-a-date': 'r1' } },
    { routines: [], workouts: [], bodyweight: [{ d: '2026-99-01', w: 80 }] },
    { routines: [], workouts: [], profile: { name: 'x'.repeat(50000) } },
  ])('rejects invalid field bounds case %#', backup => expect(() => validateBackup(backup)).toThrow())

  it('rejects object inputs larger than the import limit', () => {
    expect(() => validateBackup({ routines: [], workouts: [], notes: 'x'.repeat(MAX_BACKUP_BYTES + 1) })).toThrow()
  })
  it('accepts a structurally valid current backup', () => {
    const backup = valid()
    expect(validateBackup(backup)).toBe(backup)
    expect(MAX_BACKUP_BYTES).toBe(5 * 1024 * 1024)
  })

  it.each([
    [], 'enabled', { rest: 'true' }, { timedSet: 1 }, { workoutReminder: null },
    { trainingTime: '24:00' }, { leadMinutes: 121 }, { checkinDay: -1 }, { checkinDay: 1.5 },
    { checkinTime: '7:30' }, { quietHours: [] }, { quietHours: { enabled: 'false' } },
    { quietHours: { start: '22:60' } }, { quietHours: { end: '24:00' } },
  ].map(notifications => ({ notifications })))('rejects notification preferences that would restore invalid controls: %j', ({ notifications }) => {
    expect(() => validateBackup({ ...valid(), notifications })).toThrow('notification')
  })

  it('accepts bounded notification preferences and preserves legacy backups', () => {
    const notifications = {
      rest: true, timedSet: false, workoutReminder: true, professional: true,
      weightReminder: false, measurementReminder: false, trainingTime: '00:00',
      leadMinutes: 360, checkinDay: 6, checkinTime: '23:59',
      quietHours: { enabled: true, start: '22:00', end: '07:00' },
    }
    expect(validateBackup({ ...valid(), notifications }).notifications).toEqual(notifications)
    expect(validateBackup(valid())).not.toHaveProperty('notifications')
  })

  it.each([
    null,
    [],
    { routines: [], workouts: [{ entries: null }] },
    { routines: [{ ex: [null] }], workouts: [] },
    { routines: [], workouts: [], bodyweight: [null] },
    { routines: [], workouts: [], active: { entries: [{ id: 'x', sets: null }] } },
  ])('rejects malformed data that could crash a screen: %j', backup => {
    expect(() => validateBackup(backup)).toThrow()
  })

  it('rejects prototype-pollution keys at any depth', () => {
    const backup = JSON.parse('{"routines":[],"workouts":[],"profile":{"__proto__":{"admin":true}}}')
    expect(() => validateBackup(backup)).toThrow('unsafe property')
  })
})
