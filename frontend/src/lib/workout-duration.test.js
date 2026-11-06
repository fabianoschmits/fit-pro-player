import { describe, expect, it } from 'vitest'
import { estimateExerciseDuration, estimateWorkoutDuration, fitWorkoutToMinutes, createFlexSelection, toggleFlexSelection, confirmFlexSelection } from './workout-duration.js'

describe('FPP Flex duration and selection', () => {
  it('uses actual reps, timed and cardio rows, including explicit warmups', () => {
    expect(estimateExerciseDuration({ sets: 4, reps: 8, rest: 90 })).toBe(366)
    expect(estimateExerciseDuration({ mode: 'time', sets: 2, sec: 40, rest: 30 })).toBe(110)
    expect(estimateExerciseDuration({ mode: 'cardio', sets: 1, min: 12 })).toBe(720)
    expect(estimateExerciseDuration({ target: { rest: 60 }, sets: [{ r: 5, warmup: true }, { r: 8 }, { r: 6 }] })).toBe(177)
    expect(estimateWorkoutDuration([])).toBe(0)
  })
  it('counts preparation, transitions and breaks once and shares superset rest per round', () => {
    const exercises = Array.from({ length: 4 }, (_, i) => ({ id: String(i), sets: 3, reps: 10, rest: 60 }))
    expect(estimateWorkoutDuration(exercises)).toBe(45 + 4 * 210 + 3 * 75 + 45)
    expect(estimateWorkoutDuration(exercises.slice(0, 2).map(ex => ({ ...ex, sg: 'pair' })))).toBe(45 + 180 + 120)
  })
  it('keeps every exercise when it fits and selects deterministic whole groups otherwise', () => {
    const exercises = [
      { id: '0025', sets: 5, reps: 12, rest: 180 },
      { id: '0047', sets: 5, reps: 12, rest: 180 },
      { id: '0294', sets: 3, reps: 12, rest: 90, sg: 'pair' },
      { id: '0201', sets: 3, reps: 12, rest: 90, sg: 'pair' },
      { id: '0043', sets: 4, reps: 10, rest: 120 },
    ]
    expect(fitWorkoutToMinutes(exercises, 180).selectedIndices).toEqual([0, 1, 2, 3, 4])
    const context = { exerciseIndex: { '0025': { tg: 'chest' }, '0047': { tg: 'chest' }, '0294': { tg: 'chest' }, '0201': { tg: 'chest' }, '0043': { tg: 'quadriceps' } } }
    const fitted = fitWorkoutToMinutes(exercises, 25, context)
    expect(fitted).toEqual(fitWorkoutToMinutes(exercises, 25, context))
    expect(fitted.selectedIndices.length).toBeGreaterThan(0)
    expect(fitted.selectedIndices.includes(2)).toBe(fitted.selectedIndices.includes(3))
    expect(fitted.selectedIndices).toContain(0)
    expect(fitted.selectedIndices).toContain(4)
  })
  it('preserves duplicate positions and prescription during review and confirmation', () => {
    const entries = Array.from({ length: 3 }, () => ({ id: '0025', target: { sets: 4, reps: 10, weight: 30 }, sets: Array.from({ length: 4 }, () => ({ r: 10, w: 30, done: false })) }))
    const active = { entries, start: null, cur: 2, prescribedEntries: [{ id: '0025' }] }
    const original = structuredClone(active)
    const full = createFlexSelection(active, 60, 60)
    expect(full.phase).toBe('confirmed')
    expect(full.outline.every(item => item.selected)).toBe(true)
    const review = { ...active, flex: createFlexSelection(active, 20, 60) }
    expect(review.flex.phase).toBe('review')
    expect(review.flex.outline.map(item => item.key)).toEqual(['position:0', 'position:1', 'position:2'])
    const toggled = toggleFlexSelection(review, 1)
    const confirmed = confirmFlexSelection({ ...review, flex: toggled })
    expect(confirmed.entries.length).toBeGreaterThan(0)
    expect(confirmed.cur).toBe(0)
    expect(confirmed.prescribedEntries).toEqual(active.prescribedEntries)
    expect(active).toEqual(original)
    expect(confirmed.entries.every(entry => entry.sets.every(set => !set.done && set.w === 30))).toBe(true)
  })
  it('toggles a whole superset and refuses an empty selection', () => {
    const active = { start: null, entries: [{ id: 'a', sg: 's', sets: 2, reps: 10 }, { id: 'b', sg: 's', sets: 2, reps: 10 }] }
    active.flex = createFlexSelection(active, 30, 60)
    expect(toggleFlexSelection(active, 0).outline.every(item => item.selected)).toBe(true)
    expect(() => confirmFlexSelection({ ...active, flex: { ...active.flex, outline: active.flex.outline.map(item => ({ ...item, selected: false })) } })).toThrow()
  })
  it('preserves a fundamental movement when an accessory comes first', () => {
    const exercises = ['0294', '0043', '0025'].map(id => ({ id, sets: 5, reps: 10, rest: 120 }))
    const fitted = fitWorkoutToMinutes(exercises, 15)
    expect(fitted.selectedIndices).toEqual([1])
    expect(fitted.estimatedSeconds).toBeLessThanOrEqual(15 * 60)
  })
})
