import { describe, expect, it } from 'vitest'
import { applyPersonalSettings, personalSettingsDraft } from './personal-settings.js'

const state = () => ({ profile: { name: 'Ana Silva', birthDate: '1995-01-01', sex: 'female', heightCm: 175, startWeight: 75, goal: 'build_muscle', experience: 'intermediate', completedAt: 'registered' }, body: 'female', unit: 'kg', targetW: 70, bodyweight: [{ d: '2026-10-09', w: 74, t: 1 }], routines: [{ id: 'custom', ex: [{ sets: 4 }] }], week: { 1: 'custom' }, dayPlan: { '2026-10-10': 'custom' }, assignedProgram: { assignmentId: 'client-plan' }, workouts: [{ id: 'history' }], active: { id: 'running' } })

describe('personal settings preserve training', () => {
  it('updates personal data without regenerating routines, schedule, assignment or weight history', () => {
    const current = state(), baseline = personalSettingsDraft(current)
    const previous = structuredClone(current)
    applyPersonalSettings(current, { ...baseline, name: 'Maria Souza', goal: 'lose_weight', experience: 'advanced' }, baseline, { today: '2026-10-10', now: 2 })
    expect(current.profile.name).toBe('Maria Souza')
    expect(current.profile.goal).toBe('lose_weight')
    for (const key of ['routines', 'week', 'dayPlan', 'assignedProgram', 'workouts', 'active', 'bodyweight']) expect(current[key]).toEqual(previous[key])
    expect(current.profile.completedAt).toBe('registered')
  })
  it('records an explicitly changed current weight once for today and clears an optional target', () => {
    const current = state(), baseline = personalSettingsDraft(current)
    const draft = { ...baseline, weight: '72,5', targetWeight: '' }
    applyPersonalSettings(current, draft, baseline, { today: '2026-10-10', now: 2 })
    applyPersonalSettings(current, draft, baseline, { today: '2026-10-10', now: 3 })
    expect(current.bodyweight).toEqual([{ d: '2026-10-09', w: 74, t: 1 }, { d: '2026-10-10', w: 72.5, t: 3 }])
    expect(current.targetW).toBeNull()
  })
  it('retains a concurrent weight entry if the weight field was not changed', () => {
    const current = state(), baseline = personalSettingsDraft(current)
    current.bodyweight.push({ d: '2026-10-10', w: 73, t: 2 })
    current.profile.startWeight = 73
    applyPersonalSettings(current, { ...baseline, name: 'Maria Souza' }, baseline, { today: '2026-10-10', now: 3 })
    expect(current.profile.startWeight).toBe(73)
    expect(current.bodyweight.at(-1)).toEqual({ d: '2026-10-10', w: 73, t: 2 })
  })
  it.each([{ birthDate: '2026-02-30' }, { birthDate: '2030-01-01' }, { height: '0,80' }, { weight: '-10' }, { targetWeight: '-5' }, { name: ' ' }])('rejects invalid data without partial changes: %j', patch => {
    const current = state(), baseline = personalSettingsDraft(current), previous = structuredClone(current)
    expect(() => applyPersonalSettings(current, { ...baseline, ...patch }, baseline, { today: '2026-10-10', now: 2 })).toThrow()
    expect(current).toEqual(previous)
  })
  it('rejects a unit change during editing to avoid recording a weight in the wrong unit', () => {
    const current = state(), baseline = personalSettingsDraft(current)
    current.unit = 'lb'
    expect(() => applyPersonalSettings(current, { ...baseline, weight: '72,5' }, baseline, { today: '2026-10-10', now: 2 })).toThrow('settings-context-changed')
    expect(current.bodyweight).toHaveLength(1)
  })
})
