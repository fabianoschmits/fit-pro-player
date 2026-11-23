// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DEF, useStore } from './useStore.js'
import { createTrainingRepository } from '../lib/training-repository.js'
import { readSessionRecoveryDraft } from '../lib/session-recovery.js'

const accountId = '11111111-1111-4111-8111-111111111111'
const comparison = { version: 1, origin: 'personal', planned: [{ exerciseId: 'custom', workSets: 3, muscleWeights: { chest: 1 } }], adjusted: null, flexApplied: false }
beforeEach(async () => { vi.useFakeTimers(); localStorage.clear(); await useStore.getState().activateLocalScope(accountId) })
afterEach(async () => { await useStore.getState().activateLocalScope(null); vi.clearAllTimers(); vi.useRealTimers(); localStorage.clear() })

it('persists the original in the durable start and recovers active comparison independently of current routines', async () => {
  const active = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', d: '2026-11-23', name: 'Peito', start: null, comparison: structuredClone(comparison),
    entries: [{ id: 'custom', muscleSnapshot: { muscleWeights: { chest: 1 } }, target: { sets: 3 }, sets: [{}, {}, {}] }] }
  const state = structuredClone(DEF)
  state.active = active
  useStore.setState({ S: state })
  const client = { rpc: async (_name, args) => ({ data: {
    id: args.p_session_id, user_id: accountId, routine_id: null, assignment_id: null, status: 'active', revision: 1,
    writer_token: 'writer', mass_unit: 'kg', prescription_snapshot: args.p_prescription_snapshot,
    started_at: '2026-11-23T12:00:00Z', completed_at: null, updated_at: '2026-11-23T12:00:00Z',
  } }) }
  useStore.getState().configureSessionRecovery(createTrainingRepository({ client, accountId }), accountId)
  await useStore.getState().startSessionRecovery(active)
  expect(readSessionRecoveryDraft({ accountId }).session.prescriptionSnapshot).toMatchObject({ comparison,
    exercises: [{ id: 'custom', muscleSnapshot: { muscleWeights: { chest: 1 } } }] })
  await useStore.getState().flushPersistence()
  await useStore.getState().activateLocalScope(null)
  await useStore.getState().activateLocalScope(accountId)
  expect(useStore.getState().S.active.comparison).toEqual(comparison)
  expect(useStore.getState().S.active.entries[0].muscleSnapshot.muscleWeights).toEqual({ chest: 1 })
  useStore.getState().update(next => { next.routines = [] })
  expect(useStore.getState().S.active.comparison.planned[0].workSets).toBe(3)
})
