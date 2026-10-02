// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from './store/useStore.js'
import { beginWorkout, startFlow } from './sheets.jsx'
const mocks = vi.hoisted(() => ({ nav: vi.fn() }))
vi.mock('./lib/nav.js', () => ({ nav: mocks.nav }))
vi.mock('./lib/supabase-client.js', () => ({ getBrowserSupabaseClient: () => null }))
const account = '12345678-1234-4234-8234-123456789012'
beforeEach(async () => {
  localStorage.clear(); await useStore.getState().activateLocalScope(account)
  const state = structuredClone(DEF); state.weighBeforeWorkout = false; state.onboardingDone = true
  state.routines = [{ id: 'assigned', assigned: true, assignmentId: 'a', programVersionId: 'v', assignedDayKey: 'monday', ex: [{ id: '0025', sets: 2, reps: 8, weight: 40, rest: 20, sg: 'pair' }] }]
  state.exWeights = { '0025': { w: 90 } }; state.workouts = [{ entries: [{ id: '0025', sets: [{ w: 85, r: 12, done: true }] }] }]
  useStore.setState({ S: state })
})
describe('central assigned routine start', () => {
  for (const launch of [() => startFlow('assigned'), () => beginWorkout('assigned', null)]) {
    it('registers an assigned execution from every central entry while preserving the prescription', () => {
      launch()
      const { active, pendingProfessionalEvents } = useStore.getState().S
      expect(active.professionalExecutionId).toMatch(/^[0-9a-f-]{36}$/)
      expect(active.entries[0].sets).toEqual([{ w: 40, r: 8, done: false }, { w: 40, r: 8, done: false }])
      expect(active.entries[0].plan).toBeNull()
      expect(active.prescribedEntries[0].rest).toBe(20)
      expect(pendingProfessionalEvents[0]).toMatchObject({ accountId: account, type: 'start', assignmentId: 'a', dayKey: 'monday' })
    })
  }
})
