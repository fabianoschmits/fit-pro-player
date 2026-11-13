import { expect, it } from 'vitest'
import { markPendingDomains, preferenceFingerprint, preferenceValues } from './domain-sync-state.js'

const base = () => ({ planMode: 'weekly', week: {}, dayPlan: {}, routines: [], bodyweight: [], bodyMeasurements: [], workouts: [], profile: { startWeight: null }, displayUnit: 'kg', _pendingSync: {} })

it('keeps unfinished onboarding drafts local while syncing completion', () => {
  const state = { ...base(), onboardingDraft: { kind: 'professional', owner: 'account:a', values: { bio: 'Draft' } }, onboardingVersion: 1 }
  expect(preferenceValues(state)).not.toHaveProperty('onboardingDraft')
  expect(preferenceValues(state).onboardingVersion).toBe(1)
  expect(preferenceFingerprint(state)).toBe(preferenceFingerprint({ ...state, onboardingDraft: null }))
})

it('marks only locally edited domains and keeps pending markers out of preferences', () => {
  const previous = base()
  const next = { ...previous, bodyweight: [{ d: '2026-10-20', w: 72 }], _pendingSync: {} }
  markPendingDomains(previous, next)
  expect(next._pendingSync).toEqual({ body: true })
  expect(preferenceFingerprint(next)).toBe(preferenceFingerprint(previous))
})

it('retains an earlier failed write while a different domain changes', () => {
  const previous = { ...base(), _pendingSync: { body: true } }
  const next = { ...previous, profile: { startWeight: 72 } }
  markPendingDomains(previous, next)
  expect(next._pendingSync).toEqual({ body: true, preferences: true })
})

it('keeps pending workout deletions in the local recovery journal, outside preferences', () => {
  const previous = base()
  const next = { ...previous, workouts: [], _pendingWorkoutDeletes: ['session-1'] }
  markPendingDomains(previous, next)
  expect(next._pendingSync).toEqual({})
  expect(preferenceFingerprint(next)).toBe(preferenceFingerprint(previous))
})
