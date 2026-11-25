import { expect, it } from 'vitest'
import { buildWeeklyPerformance } from './weekly-progress-performance.js'
import { buildWeeklyProgress } from './weekly-progress.js'
import { buildWeeklyInsights } from './weekly-progress-insights.js'
const options = { now: new Date('2026-11-18T15:00:00Z'), weekStart: '2026-11-16', timeZone: 'America/Sao_Paulo' }
const w = (id, d, weight, exercise = '0025', extra = {}) => ({ id, d, entries: [{ id: exercise, sets: [{ done: true, w: weight, r: 10 }], ...extra }] })
it('defaults to available entries rather than historical records or firsts', () => {
  const result = buildWeeklyPerformance({ ...options, workouts: [w('old', '2026-11-09', 40), w('new', '2026-11-16', 50)] })
  expect(result.personalRecords).toEqual([])
  expect(result.improvements[0].type).toBe('available')
})
it('permits period comparisons independently of all-time completeness', () => {
  const result = buildWeeklyPerformance({ ...options, historyComplete: false, canComparePeriods: true, workouts: [w('old', '2026-11-09', 40), w('new', '2026-11-16', 50)] })
  expect(result.personalRecords).toEqual([])
  expect(result.improvements[0].type).toBe('load')
})
it('does not emit historical firsts or records from partial evidence', () => {
  const result = buildWeeklyInsights({ historyComplete: false, canComparePeriods: false, period: {}, metrics: { workouts: 1 }, previousMetrics: {}, hasEarlierHistory: false, performance: { personalRecords: [{}], improvements: [{ type: 'first' }] } })
  expect(result.map(x => x.key)).not.toEqual(expect.arrayContaining(['weekly.records']))
  expect(result.map(x => x.key)).not.toContain('weekly.firstWeek')
  expect(result.map(x => x.key)).not.toContain('weekly.first')
})
it('does not manufacture deltas without period coverage', () => {
  const result = buildWeeklyProgress({ ...options, workouts: [w('new', '2026-11-16', 50)], canComparePeriods: false })
  expect(result.deltas.workouts.comparable).toBe(false)
})
it('does not default to comparable periods without evidence', () => {
  const result = buildWeeklyProgress({ ...options, workouts: [w('new', '2026-11-16', 50)] })
  expect(result.deltas.workouts.comparable).toBe(false)
  expect(result.insights.some(item => item.key.startsWith('weekly.frequency.'))).toBe(false)
})
it('historical conventional performance ignores a changed global bodyweight classification', async () => {
  const { registerCustom } = await import('./exercises.js')
  registerCustom([{ id: 'historical-custom', custom: true, eq: 'body weight' }])
  try {
    const workouts = [w('old', '2026-11-09', 40, 'historical-custom', { exercise: { eq: 'barbell' } }), w('new', '2026-11-16', 50, 'historical-custom', { exercise: { eq: 'barbell' } })]
    expect(buildWeeklyPerformance({ ...options, workouts, historyComplete: true }).personalRecords).toHaveLength(1)
  } finally { registerCustom([]) }
})
it('keeps calendar-only completion dates local near midnight', () => {
  const result = buildWeeklyProgress({ ...options, now: new Date('2026-11-18T01:00:00Z'), timeZone: 'Asia/Tokyo', workouts: [{ ...w('legacy', '2026-11-18', 50), completedAt: '2026-11-18' }] })
  expect(result.metrics.workouts).toBe(1)
})
it('historical exercise metadata takes priority over the current custom catalogue', () => {
  const result = buildWeeklyProgress({ ...options, workouts: [w('new', '2026-11-16', 50, 'custom', { exercise: { id: 'custom', muscleWeights: { chest: 1 } } })], exerciseCatalog: { custom: { id: 'custom', muscleWeights: { quads: 1 } } } })
  expect(result.muscles.actualLoad.chest).toBe(1)
})
it('keeps empty historical muscle maps authoritative', () => {
  const result = buildWeeklyProgress({ ...options, workouts: [w('new', '2026-11-16', 50, 'custom', { muscleSnapshot: { muscleWeights: {} } })], exerciseCatalog: { custom: { id: 'custom', muscleWeights: { chest: 1 } } } })
  expect(result.metrics.completedSets).toBe(1)
  expect(result.metrics.muscleGroupsWorked).toBe(0)
})

it.each([
  ['custom', { muscleWeights: { chest: 1 }, eq: 'barbell' }, 1],
  ['deleted', undefined, 0],
])('resolves %s only from available account metadata', (id, exercise, groups) => {
  const result = buildWeeklyProgress({ ...options, workouts: [w('new', '2026-11-16', 50, id)], exerciseCatalog: exercise ? { [id]: { id, custom: true, ...exercise } } : {} })
  expect(result.metrics.completedSets).toBe(1)
  expect(result.metrics.muscleGroupsWorked).toBe(groups)
  if (groups) expect(result.muscles.directSets.chest).toBe(null)
})

it.each([{ eq: 'assisted' }, { eq: 'body weight' }, { mode: 'time' }, { bp: 'cardio' }])('does not give conventional load records to incompatible custom modes %o', exercise => {
  const result = buildWeeklyPerformance({ ...options, historyComplete: true, workouts: [w('old', '2026-11-09', 40, 'custom'), w('new', '2026-11-16', 50, 'custom')], exerciseCatalog: { custom: { id: 'custom', custom: true, ...exercise } } })
  expect(result.personalRecords).toEqual([])
  expect(result.improvements).toEqual([])
})

it('identical names never merge distinct custom IDs', () => {
  const result = buildWeeklyPerformance({ ...options, historyComplete: true, workouts: [w('old', '2026-11-09', 40, 'one'), w('new', '2026-11-16', 50, 'two')], exerciseCatalog: { one: { id: 'one', n: 'Same' }, two: { id: 'two', n: 'Same' } } })
  expect(result.personalRecords).toEqual([])
})

it('account history completeness comes from both uncapped validated reads', async () => {
  const { createTrainingRepository } = await import('./training-repository.js')
  const evidence = []
  const query = { select() { return this }, eq() { return this }, order() { return this }, async limit() { return { data: [], error: null } } }
  const repo = createTrainingRepository({ accountId: 'account', client: { rpc: async () => ({}), from: () => query }, onHistoryRead: value => evidence.push(value) })
  await repo.loadHistory()
  expect(evidence).toEqual([{ complete: true }])
  await repo.loadHistory({ limit: 0 })
  expect(evidence[1]).toEqual({ complete: false })
})

it('builds a private catalogue without inheriting another account global overlay', async () => {
  const { registerCustom, weeklyExerciseCatalog } = await import('./exercises.js')
  const privateExercise = { id: 'other-account', n: 'Private', custom: false }
  registerCustom([privateExercise])
  try {
    expect(weeklyExerciseCatalog([]).has(privateExercise.id)).toBe(false)
    expect(weeklyExerciseCatalog([{ id: 'mine', custom: true }]).has('mine')).toBe(true)
    expect(weeklyExerciseCatalog([]).has('mine')).toBe(false)
  } finally { registerCustom([]) }
})
it('uses account muscles when historical exercise contains only a name', () => {
  const result = buildWeeklyProgress({ ...options, workouts: [w('new', '2026-11-16', 50, 'custom', { exercise: { n: 'Historical name' } })], exerciseCatalog: { custom: { id: 'custom', muscleWeights: { chest: 1 } } } })
  expect(result.muscles.actualLoad.chest).toBe(1)
})
it('an explicitly scoped catalogue never falls back to another private global exercise', async () => {
  const { registerCustom } = await import('./exercises.js')
  registerCustom([{ id: 'private-other', custom: true, muscleWeights: { chest: 1 } }])
  try {
    const result = buildWeeklyProgress({ ...options, workouts: [w('new', '2026-11-16', 50, 'private-other')], exerciseCatalog: {} })
    expect(result.metrics.muscleGroupsWorked).toBe(0)
  } finally { registerCustom([]) }
})
