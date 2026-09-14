import { describe, expect, it } from 'vitest'
import {
  BODY_MEASUREMENT_BY_ID, bodyMeasurementDelta, bodyMeasurementHistory,
  bodyMeasurementHistoryInPeriod, bodyMeasurementSnapshots, bodyMeasurementWeekKey,
  currentBodyMeasurementCheckin, latestBodyMeasurements, normalizeBodyMeasurementCheckins,
  interpolateBodyMeasurementSnapshot, normalizeBodyMeasurementGoals,
  removeBodyMeasurement, upsertBodyMeasurement,
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

  it('describes body entries as complete circumferences instead of individual muscles', () => {
    expect(BODY_MEASUREMENT_BY_ID.chest.label).toBe('Tórax')
    expect(BODY_MEASUREMENT_BY_ID.chest.circumferenceLabel).toBe('Circunferência do tórax')
    expect(BODY_MEASUREMENT_BY_ID.abdomen.guide).toContain('ao redor de todo o abdômen')
    expect(BODY_MEASUREMENT_BY_ID.hips.label).toBe('Quadris')
  })

  it('preserves the source of carried values and interpolates only the visual snapshot', () => {
    const checkins = [
      { date: '2026-08-03', values: { chest: 110, abdomen: 120 } },
      { date: '2026-08-10', values: { chest: 106 } },
    ]
    const snapshots = bodyMeasurementSnapshots(checkins)
    expect(snapshots[1].values).toEqual({ chest: 106, abdomen: 120 })
    expect(snapshots[1].directValues).toEqual({ chest: 106 })
    expect(snapshots[1].sources).toEqual({ chest: '2026-08-10', abdomen: '2026-08-03' })

    const halfway = interpolateBodyMeasurementSnapshot(checkins, new Date('2026-08-06T12:00:00').getTime())
    expect(halfway.values.chest).toBeCloseTo(108.3, 1)
    expect(halfway.values.abdomen).toBe(120)
  })

  it('uses the selected period and historical date in the actual chart series', () => {
    const checkins = [
      { date: '2026-01-01', values: { waist: 110 } },
      { date: '2026-06-01', values: { waist: 95 } },
      { date: '2026-09-01', values: { waist: 88 } },
    ]
    expect(bodyMeasurementHistoryInPeriod(checkins, 'waist', 120).map(point => point.value)).toEqual([95, 88])
    expect(bodyMeasurementHistoryInPeriod(checkins, 'waist', 365, new Date('2026-06-01T12:00:00').getTime()).map(point => point.value)).toEqual([110, 95])
  })

  it('does not leak a lone old measurement into a shorter historical period', () => {
    const checkins = [{ date: '2025-01-08', values: { waist: 94 } }]
    const through = new Date('2025-06-01T12:00:00').getTime()
    expect(bodyMeasurementHistoryInPeriod(checkins, 'waist', 30, through)).toEqual([])
    expect(bodyMeasurementHistoryInPeriod(checkins, 'waist', 0, through)).toHaveLength(1)
  })
})
