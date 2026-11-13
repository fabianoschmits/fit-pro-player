// @vitest-environment happy-dom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { todayISO } from './format.js'
import {
  completeTrainingOnboarding, createTrainingDraft, onboardingOwner, readTrainingDraft, saveTrainingDraft,
} from './onboarding.js'

const accountA = '11111111-1111-4111-8111-111111111111'
const accountB = '22222222-2222-4222-8222-222222222222'
let owner
const originalFlush = useStore.getState().flushPersistence

beforeEach(async () => {
  localStorage.clear()
  await useStore.getState().activateLocalScope(accountA)
  useStore.setState({ S: structuredClone(DEF), persistence: { state: 'saved', error: null } })
  owner = onboardingOwner(useStore, { id: accountA })
})
afterEach(() => { vi.restoreAllMocks(); useStore.setState({ flushPersistence: originalFlush }) })

const ready = () => ({
  ...createTrainingDraft(useStore.getState().S, { displayName: 'ana de SOUZA' }),
  step: 3,
  values: {
    ...createTrainingDraft(useStore.getState().S).values,
    name: 'ana de SOUZA', intention: 'self', goal: 'build_muscle', experience: 'beginner',
    startWeight: '70', preferredWorkoutMinutes: 45, unit: 'kg', planMode: 'weekly',
  },
  days: [1, 3, 5],
})

describe('account-scoped training onboarding', () => {
  it('restores answers and step after loading the same account without altering its plan', async () => {
    useStore.getState().update(state => {
      state.routines = [{ id: 'active-routine', name: 'Existing', ex: [] }]
      state.week = { 2: 'active-routine' }
      state.active = { routineId: 'active-routine', entries: [] }
    })
    const draft = { ...ready(), step: 2 }
    await saveTrainingDraft(useStore, owner, draft)
    await useStore.getState().activateLocalScope(accountA)
    expect(readTrainingDraft(useStore.getState().S, owner)).toMatchObject({
      step: 2, values: { name: 'Ana de Souza', startWeight: '70' }, days: [1, 3, 5],
    })
    expect(useStore.getState().S.week).toEqual({ 2: 'active-routine' })
    expect(useStore.getState().S.routines).toEqual([{ id: 'active-routine', name: 'Existing', ex: [] }])
    expect(useStore.getState().S.onboardingDone).toBe(false)
  })

  it('rejects a foreign account draft and stale owner writes', async () => {
    await saveTrainingDraft(useStore, owner, ready())
    const foreign = structuredClone(useStore.getState().S.onboardingDraft)
    await useStore.getState().activateLocalScope(accountB)
    useStore.getState().update(state => { state.onboardingDraft = foreign })
    const otherOwner = onboardingOwner(useStore, { id: accountB })
    expect(readTrainingDraft(useStore.getState().S, otherOwner)).toBeNull()
    expect(onboardingOwner(useStore, { id: accountA })).toBeNull()
    await expect(saveTrainingDraft(useStore, owner, ready())).rejects.toThrow('onboarding-account-changed')
    expect(useStore.getState().S.onboardingDone).toBe(false)
  })

  it('hides an account draft while authentication has no active user', () => {
    expect(onboardingOwner(useStore, null)).toBeNull()
  })

  it('persists only allowed non-secret answers', async () => {
    const draft = ready()
    draft.values.password = 'secret-password'
    draft.values.confirmPassword = 'secret-confirmation'
    draft.values.preferredWorkoutMinutes = { password: 'secret-in-malformed-field' }
    await saveTrainingDraft(useStore, owner, draft)
    expect(JSON.stringify(useStore.getState().S.onboardingDraft)).not.toContain('secret')
    expect(localStorage.getItem(`fpp_account_cache_v1:${accountA}`)).not.toContain('secret')
  })

  it('keeps birth date and body choice unset for a new profile', () => {
    const draft = createTrainingDraft(useStore.getState().S, { displayName: 'ana' })
    expect(draft.values.birthDate).toBe('')
    expect(draft.values.sex).toBe('')
    expect(draft.values.height).toBe('')
  })

  it('generates the self plan only on completion and assigns selected weekdays', async () => {
    const draft = ready()
    await saveTrainingDraft(useStore, owner, draft)
    expect(useStore.getState().S.routines).toHaveLength(0)
    expect(await completeTrainingOnboarding(useStore, owner, draft)).toBe('/plan')
    const state = useStore.getState().S
    expect(state.profile).toMatchObject({ name: 'Ana de Souza', birthDate: '', heightCm: null, startWeight: 70, preferredWorkoutMinutes: 45 })
    expect(state.routines.filter(routine => routine.planGenerated)).toHaveLength(3)
    expect(state.routines.every(routine => routine.ex.length > 0)).toBe(true)
    expect(Object.keys(state.week)).toEqual(['1', '3', '5'])
    expect(new Set(Object.values(state.week)).size).toBe(3)
    expect(state.bodyweight).toEqual([expect.objectContaining({ d: todayISO(), w: 70 })])
    expect(state.onboardingDone).toBe(true)
    expect(state.onboardingVersion).toBe(1)
    expect(state.onboardingDraft).toBeNull()
  })

  it('converts pounds to canonical kilograms and assigns a daily workout', async () => {
    const draft = ready()
    draft.values = { ...draft.values, unit: 'lb', startWeight: '154,3', targetWeight: '143,3', planMode: 'daily' }
    await completeTrainingOnboarding(useStore, owner, draft)
    const state = useStore.getState().S
    expect(state.profile.startWeight).toBeCloseTo(69.989303, 5)
    expect(state.targetW).toBeCloseTo(64.999787, 5)
    expect(state.dayPlan[todayISO()]).toBe(state.routines[0].id)
    expect(state.week).toEqual({})
  })

  it('completes the professional-following branch with a name and no personal plan or measurements', async () => {
    const draft = createTrainingDraft(useStore.getState().S, { displayName: 'Ana' })
    draft.values.intention = 'professional'
    expect(await completeTrainingOnboarding(useStore, owner, draft)).toBe('/student/professionals/add')
    const state = useStore.getState().S
    expect(state.profile.name).toBe('Ana')
    expect(state.profile.birthDate).toBe('')
    expect(state.profile.startWeight).toBeNull()
    expect(state.bodyweight).toEqual([])
    expect(state.routines).toEqual([])
    expect(state.week).toEqual({})
    expect(state.onboardingDone).toBe(true)
  })

  it('retains the draft and incomplete state when storage rejects completion', async () => {
    const draft = ready()
    await saveTrainingDraft(useStore, owner, draft)
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await expect(completeTrainingOnboarding(useStore, owner, draft)).rejects.toThrow('onboarding-storage-failed')
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(useStore.getState().S.routines).toEqual([])
    expect(readTrainingDraft(useStore.getState().S, owner)).toMatchObject({ step: 3, values: { startWeight: '70' } })
    write.mockRestore()
  })

  it('does not advance persisted progress when the native mirror flush fails', async () => {
    const draft = ready()
    await saveTrainingDraft(useStore, owner, { ...draft, step: 1 })
    vi.spyOn(useStore.getState(), 'flushPersistence').mockResolvedValue(false)
    await expect(saveTrainingDraft(useStore, owner, { ...draft, step: 2 })).rejects.toThrow('onboarding-storage-failed')
    expect(readTrainingDraft(useStore.getState().S, owner).step).toBe(1)
    expect(useStore.getState().S.onboardingDone).toBe(false)
  })

  it.each(['draft', 'completion'])('preserves history arriving while a %s write fails', async operation => {
    const draft = ready()
    await saveTrainingDraft(useStore, owner, { ...draft, step: 1 })
    let release
    useStore.setState({ flushPersistence: () => new Promise(resolve => { release = resolve }) })
    const pending = operation === 'draft'
      ? saveTrainingDraft(useStore, owner, { ...draft, step: 2 })
      : completeTrainingOnboarding(useStore, owner, draft)
    useStore.getState().update(state => {
      state.workouts.push({ id: 'arrived-workout', d: todayISO(), name: 'Treino recebido', entries: [] })
      state.theme = 'light'
    })
    release(false)
    await expect(pending).rejects.toThrow('onboarding-storage-failed')
    expect(useStore.getState().S.workouts).toEqual([{ id: 'arrived-workout', d: todayISO(), name: 'Treino recebido', entries: [] }])
    expect(useStore.getState().S.theme).toBe('light')
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(useStore.getState().S.onboardingVersion).not.toBe(1)
    expect(useStore.getState().S.routines).toEqual([])
    expect(readTrainingDraft(useStore.getState().S, owner).step).toBe(1)
  })

  it('does not overwrite a newer draft after an older draft flush fails', async () => {
    const draft = ready()
    await saveTrainingDraft(useStore, owner, { ...draft, step: 1 })
    let release
    useStore.setState({ flushPersistence: () => new Promise(resolve => { release = resolve }) })
    const pending = saveTrainingDraft(useStore, owner, { ...draft, step: 2 })
    useStore.getState().update(state => { state.onboardingDraft = { ...state.onboardingDraft, step: 3, values: { ...state.onboardingDraft.values, name: 'Resposta nova' } } })
    release(false)
    await expect(pending).rejects.toThrow('onboarding-storage-failed')
    expect(readTrainingDraft(useStore.getState().S, owner)).toMatchObject({ step: 3, values: { name: 'Resposta Nova' } })
  })

  it('cannot restore one account snapshot over another after an interrupted native completion', async () => {
    const draft = ready()
    await saveTrainingDraft(useStore, owner, draft)
    let release
    useStore.setState({ flushPersistence: () => new Promise(resolve => { release = resolve }) })
    const pending = completeTrainingOnboarding(useStore, owner, draft)
    await useStore.getState().activateLocalScope(accountB)
    useStore.getState().update(state => { state.profile.name = 'Bruna'; state.routines = [{ id: 'bruna-plan', name: 'Treino de Bruna', ex: [] }] })
    release(false)
    await expect(pending).rejects.toThrow('onboarding-account-changed')
    expect(useStore.getState().S.profile.name).toBe('Bruna')
    expect(useStore.getState().S.onboardingDone).toBe(false)
    expect(useStore.getState().S.routines).toEqual([{ id: 'bruna-plan', name: 'Treino de Bruna', ex: [] }])
  })
})
