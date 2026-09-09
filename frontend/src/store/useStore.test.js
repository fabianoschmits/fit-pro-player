// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { DEF, hasData, normalizeState } from './useStore.js'
import { starterRoutines } from '../lib/starter.js'

describe('state migration for first-run profiles', () => {
  it('seeds ready-made routines without treating a fresh install as user data', () => {
    const state = normalizeState(DEF)
    expect(state.onboardingDone).toBe(false)
    expect(state.routines).toHaveLength(7)
    expect(state.week).toEqual({})
    expect(hasData(state)).toBe(false)
  })

  it('does not send an older untouched starter plan past the new wizard', () => {
    const routines = starterRoutines({ bodyweight: [] })
    const state = normalizeState({
      routines,
      week: { 1: routines[0].id, 3: routines[1].id, 5: routines[2].id },
      workouts: [], bodyweight: [], customEx: [],
    })
    expect(state.onboardingDone).toBe(false)
    expect(hasData(state)).toBe(false)
  })

  it('sends established legacy data through the wizard without losing progress', () => {
    const state = normalizeState({
      body: 'female', routines: [], week: {}, dayPlan: {}, customEx: [],
      bodyweight: [{ d: '2026-08-01', w: 68, t: 1 }],
      workouts: [{ id: 'w1', d: '2026-08-02', entries: [] }],
      exWeights: { '0025': 60 },
    })
    expect(state.onboardingDone).toBe(false)
    expect(state.profile).toMatchObject({ sex: 'female', startWeight: 68 })
    expect(state.workouts).toHaveLength(1)
    expect(state.exWeights).toEqual({ '0025': 60 })
  })

  it('keeps the personal profile and plan mode through JSON backup restoration', () => {
    const original = normalizeState({
      ...DEF,
      onboardingDone: true,
      planMode: 'daily',
      profile: { name: 'Ana', avatarId: 'avatar-42', birthDate: '1990-09-09', sex: 'female', heightCm: 167, startWeight: 71, goal: 'lose_weight', experience: 'intermediate' },
    })
    const restored = normalizeState(JSON.parse(JSON.stringify(original)))
    expect(restored.planMode).toBe('daily')
    expect(restored.profile).toMatchObject({
      name: 'Ana', avatarId: 'avatar-42', birthDate: '1990-09-09', sex: 'female', heightCm: 167,
      startWeight: 71, goal: 'lose_weight', experience: 'intermediate',
    })
  })

  it('updates the profile weight from the latest weigh-in when restoring saved data', () => {
    const restored = normalizeState({
      ...DEF,
      onboardingDone: true,
      profile: { name: 'Ana', birthDate: '1990-09-09', heightCm: 167, startWeight: 71, goal: 'lose_weight', experience: 'intermediate' },
      bodyweight: [{ d: '2026-09-08', w: 72.4, t: 1 }, { d: '2026-09-09', w: 72.1, t: 2 }],
    })

    expect(restored.profile.startWeight).toBe(72.1)
  })
})
