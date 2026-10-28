import { describe, expect, it } from 'vitest'
import { applyDomainState } from './domain-state.js'

describe('domain state projection', () => {
  it('keeps each domain boundary narrow when applying server data to the UI state', () => {
    const state = { lang: 'en', routines: [{ id: 'old' }], week: { 1: 'old' }, dayPlan: {}, workouts: [{ id: 'old' }], bodyweight: [], bodyMeasurements: [], displayUnit: 'kg' }
    const preferences = applyDomainState(state, 'preferences', { displayUnit: 'lb', massUnit: 'kg', values: { lang: 'pt', theme: 'light' } })
    expect(preferences).toMatchObject({ lang: 'pt', theme: 'light', displayUnit: 'lb', routines: [{ id: 'old' }] })

    const plan = applyDomainState(preferences, 'plan', { routines: [{ id: 'routine-1', title: 'Push', prescription: { emoji: 'fire', ex: [] } }], schedule: { mode: 'weekly', values: { week: { 1: 'routine-1' }, dayPlan: {} } } })
    expect(plan).toMatchObject({ routines: [{ id: 'routine-1', name: 'Push', emoji: 'fire' }], week: { 1: 'routine-1' }, workouts: [{ id: 'old' }] })

    const body = applyDomainState(plan, 'body', { weights: [{ id: 'weight-1', date: '2026-10-19', weightKg: 80, updatedAt: '2026-10-19T10:00:00Z' }], measurements: [{ id: 'checkin-1', date: '2026-10-19', valuesCm: { chest: 100 }, note: 'morning', createdAt: '2026-10-19T09:00:00Z', updatedAt: '2026-10-19T10:00:00Z' }] })
    expect(body).toMatchObject({ bodyweight: [{ id: 'weight-1', d: '2026-10-19', w: 80 }], bodyMeasurements: [{ id: 'checkin-1', values: { chest: 100 }, notes: 'morning' }] })
    expect(body.bodyweight[0].t).toBe(new Date('2026-10-19').getTime())
  })

  it('places a migrated weigh-in on its measured day, even when every row was updated today', () => {
    const body = applyDomainState({ bodyweight: [], bodyMeasurements: [] }, 'body', {
      weights: [
        { id: 'old', date: '2025-09-04', weightKg: 110, updatedAt: '2026-10-20T12:00:00Z' },
        { id: 'new', date: '2026-10-20', weightKg: 68.5, updatedAt: '2026-10-20T12:00:00Z' },
      ],
      measurements: [],
    })
    expect(body.bodyweight.map(entry => entry.t)).toEqual([
      new Date('2025-09-04').getTime(),
      new Date('2026-10-20').getTime(),
    ])
  })

  it('uses only completion payloads for history and never invents a workout from session metadata', () => {
    const result = applyDomainState({ workouts: [{ id: 'old' }] }, 'history', [{ session: { id: 'a' }, workout: null }, { session: { id: 'b' }, workout: { id: 'b', entries: [] } }])
    expect(result.workouts).toEqual([{ id: 'b', entries: [] }])
  })

  it('keeps remotely loaded workouts in chronological state order', () => {
    const records = [
      { workout: { id: 'new', d: '2026-10-20', start: 2, entries: [] } },
      { workout: { id: 'old', d: '2026-10-19', start: 1, entries: [] } },
    ]
    expect(applyDomainState({ workouts: [] }, 'history', records).workouts.map(workout => workout.id)).toEqual(['old', 'new'])
  })
})
it('rejects a stale refresh after a newer selected plan was applied', () => {
 const selected = { planServerRevision: 8, activeLibraryId: 'new', routines:[{id:'new-routine'}], week:{1:'new-routine'}, workouts:[{id:'history'}] }
 expect(applyDomainState(selected,'plan',{schedule:{revision:7,values:{libraryId:'old'}},routines:[]})).toBe(selected)
 const next=applyDomainState(selected,'plan',{schedule:{revision:9,mode:'weekly',values:{libraryId:'personal',week:{1:'own'}}},routines:[{id:'own',title:'Meu ABC',prescription:{ex:[]}}]})
 expect(next.activeLibraryId).toBe('personal');expect(next.assignedProgram).toBeNull();expect(next.workouts).toBe(selected.workouts)
})
