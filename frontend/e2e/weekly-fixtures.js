import { stateFixture } from './fixtures.test.js'
export const WEEKLY_NOW = new Date('2026-11-18T15:00:00Z')
export const weeklySession = (id, d, count, minutes, load = 50, planned = null, adjusted = null) => ({ id, d, name: `Treino ${id}`, ...(minutes == null ? {} : { durationMs: minutes * 60000 }),
  entries: [{ id: '0025', muscleSnapshot: { muscleWeights: { chest: 1, triceps: 0.4 } }, sets: Array.from({ length: count }, () => ({ done: true, w: load, r: 10 })) }],
  ...(planned == null ? {} : { comparison: { version: 1, origin: 'personal', planned: [{ exerciseId: '0025', workSets: planned, muscleWeights: { chest: 1, triceps: 0.4 } }], adjusted: [{ exerciseId: '0025', workSets: adjusted, muscleWeights: { chest: 1, triceps: 0.4 } }], flexApplied: planned !== adjusted } }) })
export function weeklyState() {
  const state = stateFixture()
  state.workouts = [weeklySession('C', '2026-11-09', 8, 35, 40), weeklySession('D', '2026-11-10', 10, 45, 45), weeklySession('E', '2026-11-12', 20, 60, 45), weeklySession('A', '2026-11-16', 10, 40, 50, 12, 10), weeklySession('B', '2026-11-18', 14, 50, 55)]
  return state
}
