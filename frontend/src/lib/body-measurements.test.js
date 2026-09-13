import { describe, expect, it } from 'vitest'
import {
  bodyMeasurementDelta, bodyMeasurementHistory, bodyMeasurementWeekKey,
  currentBodyMeasurementCheckin, latestBodyMeasurements, normalizeBodyMeasurementCheckins,
  normalizeBodyMeasurementGoals, removeBodyMeasurement, upsertBodyMeasurement,
} from './body-measurements.js'

describe('body measurement check-ins', () => {
  it('uses Monday as the stable weekly check-in key', () => {
    expect(bodyMeasurementWeekKey('2026-09-13')).toBe('2026-09-07')
    expect(bodyMeasurementWeekKey('2026-09-14')).toBe('2026-09-14')
    expect(bodyMeasurementWeekKey('2027-01-01')).toBe('2026-12-28')
    expect(bodyMeasurementWeekKey('2026-02-31')).toBeNull()
  })

  it('merges individual measurements into one check-in per week', () => {
    let checkins = upsertBodyMeasurement([], { date: '2026-09-08', partId: 'chest', value: 101.24, now: 1 })
    checkins = upsertBodyMeasurement(checkins, { date: '2026-09-11', partId: 'waist', value: 88, now: 2 })
    expect(checkins).toHaveLength(1)
    expect(checkins[0]).toMatchObject({ week: '2026-09-07', date: '2026-09-11', createdAt: 1, updatedAt: 2, values: { chest: 101.2, waist: 88 } })
    expect(currentBodyMeasurementCheckin(checkins, '2026-09-13')?.values).toEqual({ chest: 101.2, waist: 88 })
  })

  it('normalizes malformed, duplicate and unknown data safely', () => {
    const normalized = normalizeBodyMeasurementCheckins([
      { date: 'bad', values: { chest: 99 } },
      { date: '2026-09-07', values: { chest: 99, invented: 12, waist: -1 } },
      { date: '2026-09-10', values: { chest: 100, waist: '87.4' } },
    ])
    expect(normalized).toHaveLength(1)
    expect(normalized[0].values).toEqual({ chest: 100, waist: 87.4 })
    expect(normalizeBodyMeasurementGoals({ chest: 105, waist: 'x', invented: 22 })).toEqual({ chest: 105 })
  })

  it('carries the latest known value forward for comparisons', () => {
    const checkins = [
      { date: '2026-08-03', values: { chest: 99, waist: 92 } },
      { date: '2026-09-07', values: { chest: 102 } },
    ]
    expect(latestBodyMeasurements(checkins, '2026-09-07')).toEqual({ chest: 102, waist: 92 })
    expect(bodyMeasurementHistory(checkins, 'chest').map(point => point.value)).toEqual([99, 102])
    expect(bodyMeasurementDelta(checkins, 'chest', 0).delta).toBe(3)
    expect(bodyMeasurementDelta(checkins, 'chest', 7).delta).toBeNull()
    expect(bodyMeasurementDelta([{ date: '2026-09-07', values: { chest: 102 } }], 'chest', 0).delta).toBeNull()
  })

  it('removes one value without deleting the rest of its check-in', () => {
    const checkins = [{ id: 'week', date: '2026-09-07', values: { chest: 100, waist: 88 } }]
    expect(removeBodyMeasurement(checkins, 'week', 'chest')[0].values).toEqual({ waist: 88 })
  })
})
