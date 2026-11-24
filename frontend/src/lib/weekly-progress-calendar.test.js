import { describe, expect, it } from 'vitest'
import { getWeekStart, getWeekEnd, getWeekRange, getPreviousWeek, getNextWeek, getWeekDays, normalizeWeekParam, getComparableWeekRange, calendarDate, calendarTimestamp, resolveWeeklyTimeZone } from './weekly-progress-calendar.js'

const zone = 'America/Sao_Paulo'
const now = new Date('2026-11-18T15:00:00Z')
describe('weekly calendar', () => {
  it.each([
    ['2026-11-16', '2026-11-16', '2026-11-22'],
    ['2026-11-22', '2026-11-16', '2026-11-22'],
    ['2026-11-01', '2026-10-26', '2026-11-01'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2024-02-29', '2024-02-26', '2024-03-03'],
  ])('normalizes calendar date %s without UTC conversion', (date, start, end) => {
    expect(getWeekStart(date, zone)).toBe(start)
    expect(getWeekEnd(date, zone)).toBe(end)
    expect(getWeekDays(start, zone)).toHaveLength(7)
  })
  it('assigns UTC midnight to the previous local day', () => {
    expect(calendarDate('2026-11-16T01:00:00Z', zone)).toBe('2026-11-15')
    expect(getWeekStart('2026-11-16T01:00:00Z', zone)).toBe('2026-11-09')
    expect(calendarDate('2026-11-16', zone)).toBe('2026-11-16')
  })
  it('uses exclusive boundaries across daylight saving changes', () => {
    const range = getWeekRange('2026-03-02', 'America/New_York')
    expect(new Date(range.startTimestamp).toISOString()).toBe('2026-03-02T05:00:00.000Z')
    expect(new Date(range.endTimestamp).toISOString()).toBe('2026-03-09T04:00:00.000Z')
    expect(range.endTimestamp - range.startTimestamp).toBe(167 * 3600000)
    expect(getNextWeek('2026-12-28', zone)).toBe('2027-01-04')
    expect(getPreviousWeek('2027-01-04', zone)).toBe('2026-12-28')
  })
  it.each(['nope', '2026-02-30', '', null, ['2026-11-09'], '999999-01-01'])('rejects invalid URL value %s', value => {
    expect(normalizeWeekParam(value, now, zone)).toBe('2026-11-16')
  })
  it('normalizes non Mondays and clamps future weeks', () => {
    expect(normalizeWeekParam('2026-11-12', now, zone)).toBe('2026-11-09')
    expect(normalizeWeekParam('2027-01-04', now, zone)).toBe('2026-11-16')
    expect(resolveWeeklyTimeZone('invalid')).toBeTruthy()
    expect(() => getWeekStart(now, 'invalid')).not.toThrow()
  })
  it('compares Monday to Wednesday with Monday to Wednesday', () => {
    expect(getComparableWeekRange('2026-11-16', now, zone)).toMatchObject({ start: '2026-11-09', end: '2026-11-12', comparableDays: 3, mode: 'same-elapsed-days' })
    expect(getComparableWeekRange('2026-11-09', now, zone)).toMatchObject({ start: '2026-11-02', end: '2026-11-09', comparableDays: 7, mode: 'full-week' })
  })
  it('changes current week at the local Monday boundary', () => {
    expect(normalizeWeekParam(null, new Date('2026-11-23T02:59:59Z'), zone)).toBe('2026-11-16')
    expect(normalizeWeekParam(null, new Date('2026-11-23T03:00:00Z'), zone)).toBe('2026-11-23')
  })
  it('starts a calendar day at the first valid time when midnight is skipped', () => {
    const range = getWeekRange('2018-10-29', 'America/Sao_Paulo')
    expect(range.endTimestamp).toBe(Date.parse('2018-11-05T02:00:00Z'))
    expect(calendarDate('2018-11-04T03:00:00Z', 'America/Sao_Paulo')).toBe('2018-11-04')
    expect(calendarTimestamp('2018-11-04', 'America/Sao_Paulo')).toBe(Date.parse('2018-11-04T03:00:00Z'))
  })
})
