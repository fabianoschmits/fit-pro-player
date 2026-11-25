import { describe, expect, it } from 'vitest'
import { buildWeeklyPerformance } from './weekly-progress-performance.js'
import { fromDisplayMass } from './mass.js'
const now = new Date('2026-11-18T15:00:00Z')
const w = (id, d, weight, reps = 10, target = {}, exercise = '0025', extra = {}) => ({ id, d, entries: [{ id: exercise, target, sets: [{ done: true, w: weight, r: reps }] }], ...extra })
const build = (workouts, extra = {}) => buildWeeklyPerformance({ workouts, weekStart: '2026-11-16', now, timeZone: 'America/Sao_Paulo', historyComplete: true, ...extra })
describe('weekly comparable performance', () => {
  it('describes a higher recorded load without claiming strength gains', () => {
    const result = build([w('old', '2026-11-09', 50), w('new', '2026-11-16', 55, 5)])
    expect(result.improvements).toContainEqual(expect.objectContaining({ exerciseId: '0025', type: 'load', previous: 50, current: 55, unit: 'kg' }))
    expect(result.personalRecords).toHaveLength(1)
  })
  it('compares repetitions only at equivalent load', () => {
    expect(build([w('old', '2026-11-09', 50, 10), w('new', '2026-11-16', 50, 12)]).improvements).toContainEqual(expect.objectContaining({ type: 'reps', previous: 10, current: 12, load: 50 }))
    expect(build([w('old', '2026-11-09', 50, 10), w('new', '2026-11-16', 45, 12)]).improvements).toHaveLength(0)
  })
  it('does not compare distinct IDs or unilateral measurement variants', () => {
    expect(build([w('old', '2026-11-09', 50), w('new', '2026-11-16', 55, 10, {}, '0047')]).improvements.filter(item => item.type !== 'first')).toHaveLength(0)
    expect(build([w('old', '2026-11-09', 50), w('new', '2026-11-16', 55, 10, { side: true })]).improvements.filter(item => item.type !== 'first')).toHaveLength(0)
  })
  it('uses canonical kg even when display preference is pounds', () => {
    const result = build([w('old', '2026-11-09', fromDisplayMass(110, 'lb')), w('new', '2026-11-16', 55)], { displayUnit: 'lb' })
    expect(result.improvements[0].previous).toBeCloseTo(49.895161)
    expect(result.improvements[0].current).toBe(55)
  })
  it.each([undefined, null, NaN, Infinity, -1])('rejects missing/invalid load %s', weight => {
    expect(build([w('old', '2026-11-09', weight), w('new', '2026-11-16', 55)]).personalRecords).toHaveLength(0)
  })
  it.each([{ bodyweight: true }, { assisted: true }, { mode: 'time' }, { mode: 'cardio' }])('does not reuse conventional load comparisons for %s', target => {
    expect(build([w('old', '2026-11-09', 50, 10, target), w('new', '2026-11-16', 55, 10, target)]).improvements).toHaveLength(0)
  })
  it('marks the first record separately instead of calling it a PR', () => {
    const result = build([w('first', '2026-11-16', 50)])
    expect(result.personalRecords).toHaveLength(0)
    expect(result.improvements[0].type).toBe('first')
  })
  it('uses all prior history and ignores later sessions when declaring records', () => {
    expect(build([w('best', '2026-10-01', 70), w('old', '2026-11-09', 50), w('new', '2026-11-16', 55), w('future', '2026-11-19', 100)]).personalRecords).toHaveLength(0)
    expect(build([w('old', '2026-11-09', 50), w('new', '2026-11-16', 55), w('later', '2026-12-01', 100)]).personalRecords).toHaveLength(1)
  })
  it('does not treat equal records as new records', () => {
    expect(build([w('old', '2026-11-09', 50), w('new', '2026-11-16', 50)]).personalRecords).toHaveLength(0)
  })
  it('labels partial historical coverage without confirmed PRs', () => {
    const result = build([w('new', '2026-11-16', 55)], { historyComplete: false })
    expect(result.personalRecords).toHaveLength(0)
    expect(result.improvements[0].type).toBe('available')
  })
  it('excludes warmups and incomplete rows from the existing best-load helper', () => {
    const workout = w('new', '2026-11-16', 50)
    workout.entries[0].sets.push({ done: true, phase: 'warmup', w: 100, r: 5 }, { done: false, w: 200, r: 5 })
    expect(build([w('old', '2026-11-09', 60), workout]).personalRecords).toHaveLength(0)
    expect(build([w('old', '2026-11-09', 60), workout]).improvements).toHaveLength(0)
  })
})

it('retains equivalent-load repetitions when a later session has a higher load', () => {
  const prior = w('prior', '2026-11-09', 60, 8)
  prior.entries[0].sets.push({ done: true, w: 50, r: 10 })
  const result = build([prior, w('more-reps', '2026-11-16', 50, 12), w('higher-load', '2026-11-17', 60, 8)])
  expect(result.improvements).toContainEqual(expect.objectContaining({ type: 'reps', load: 50, previous: 10, current: 12, workoutId: 'more-reps' }))
})

it('orders completedAt-only sessions before evaluating records on the same day', () => {
  const first = w('first', '2026-11-16', 50, 10, {}, '0025', { completedAt: '2026-11-16T12:00:00Z' })
  const second = w('second', '2026-11-16', 55, 10, {}, '0025', { completedAt: '2026-11-16T15:00:00Z' })
  expect(build([second, first]).personalRecords).toContainEqual(expect.objectContaining({ workoutId: 'second', previous: 50, current: 55 }))
})
