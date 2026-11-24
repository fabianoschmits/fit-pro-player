import { describe, expect, it } from 'vitest'
import { buildWeeklyInsights } from './weekly-progress-insights.js'
const summary = (extra = {}) => ({ period: { isCurrentWeek: true }, metrics: { workouts: 2, durationSeconds: null }, previousMetrics: { workouts: 1 },
  performance: { personalRecords: [], improvements: [] }, muscles: { ranking: [] }, planning: { flexWorkouts: 0 },
  coverage: { legacyWorkouts: 0, unknownDurationWorkouts: 0, unknownMuscleSets: 0 }, ...extra })
describe('deterministic weekly insights', () => {
  it('distinguishes empty current and historical weeks', () => {
    expect(buildWeeklyInsights(summary({ metrics: { workouts: 0 } }))[0].key).toBe('weekly.empty.current')
    expect(buildWeeklyInsights(summary({ metrics: { workouts: 0 }, period: { isCurrentWeek: false } }))[0].key).toBe('weekly.empty.past')
  })
  it('prioritizes confirmed records, then first records, then frequency', () => {
    const result = buildWeeklyInsights(summary({ performance: { personalRecords: [{}, {}], improvements: [{ type: 'first' }] } }))
    expect(result.map(item => item.key)).toEqual(['weekly.records', 'weekly.first', 'weekly.frequency.up'])
    expect(result[0].args).toEqual([2])
  })
  it.each([[3, 3, 'same'], [4, 3, 'up'], [2, 3, 'down']])('describes frequency %s vs %s neutrally', (current, previous, direction) => {
    const result = buildWeeklyInsights(summary({ metrics: { workouts: current }, previousMetrics: { workouts: previous } }))
    expect(result[0].key).toBe(`weekly.frequency.${direction}`)
  })
  it('recognizes first registered week without inventing a prior baseline', () => {
    expect(buildWeeklyInsights(summary({ previousMetrics: { workouts: 0 }, hasEarlierHistory: false }))[0].key).toBe('weekly.firstWeek')
  })
  it('does not call a new week first when earlier history exists', () => {
    expect(buildWeeklyInsights(summary({ previousMetrics: { workouts: 0 }, hasEarlierHistory: true }))[0].key).toBe('weekly.frequency.up')
  })
  it('keeps duration variation unavailable if coverage is partial', () => {
    const result = buildWeeklyInsights(summary({ deltas: { durationSeconds: { comparable: false, absolute: 1200 } }, coverage: { unknownDurationWorkouts: 1 } }))
    expect(result.some(item => item.key === 'weekly.time.up')).toBe(false)
    expect(result.some(item => item.key === 'weekly.coverage')).toBe(true)
  })
  it('can include muscular distribution and Flex without judging recovery', () => {
    const result = buildWeeklyInsights(summary({ muscles: { ranking: [{ id: 'chest' }, { id: 'upper-back' }] }, planning: { flexWorkouts: 2 } }))
    expect(result.map(item => item.key)).toEqual(['weekly.frequency.up', 'weekly.muscles', 'weekly.flex'])
  })
  it('limits to three unique, stable messages and supplies counts for pluralization', () => {
    const data = summary({ performance: { personalRecords: [{}], improvements: [{ type: 'first' }] }, planning: { flexWorkouts: 1 } })
    const result = buildWeeklyInsights(data)
    expect(result).toEqual(buildWeeklyInsights(structuredClone(data)))
    expect(result).toHaveLength(3)
    expect(new Set(result.map(item => item.key)).size).toBe(3)
    expect(result[0].args).toEqual([1])
    expect(JSON.stringify(result)).not.toMatch(/risco|falhou|compensar|deveria|recuperad|qualidade|saúde/)
  })
})
