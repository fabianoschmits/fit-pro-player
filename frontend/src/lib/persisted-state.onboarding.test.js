import { expect, it } from 'vitest'
import { projectPersistedState } from './persisted-state.js'

it.each(['training', 'professional'])('restores the %s journey draft through the real storage projection', kind => {
  const draft = { version: 1, kind, owner: 'account:ana', step: 2,
    values: { name: 'Ana', professionalName: 'Ana', bio: 'Treinos', goal: 'build_muscle', experience: 'beginner', startWeight: '70', birthDate: '', height: '', preferredWorkoutMinutes: 45, planMode: 'weekly', intent: 'self', stateUf: 'SP', cityName: 'São Paulo', specialties: ['strength'], password: 'never-persist' }, days: [1, 3, 5] }
  const projected = projectPersistedState({ onboardingDraft: draft, onboardingVersion: 1 })
  expect(projected.onboardingVersion).toBe(1)
  expect(projected.onboardingDraft).toMatchObject({ version: 1, kind, owner: 'account:ana', step: 2, days: [1, 3, 5] })
  expect(projected.onboardingDraft.values.birthDate).toBe('')
  expect(projected.onboardingDraft.values.specialties).toEqual(['strength'])
  expect(projected.onboardingDraft.values).not.toHaveProperty('password')
})
