import { expect, it } from 'vitest'
import { personalPlanPreview } from './personal-plan-preview.js'
const state = { assignedProgram: { versionId: 'v' }, activeLibraryId: 'pro', planMode: 'weekly', routines: [{ id: 'own', name: 'Atual', ex: [] }, { id: 'assigned', assigned: true, ex: [] }], week: { 1: 'assigned' }, dayPlan: { '2026-11-01': 'assigned' } }
it('previews personal configuration from the latest server snapshot using only live personal routines', () => {
  const preview = personalPlanPreview(state, [{ source_type: 'self', updated_at: '2026-10-01', personal_plan: { mode: 'weekly' } }, { source_type: 'self', updated_at: '2026-11-01', personal_plan: { mode: 'daily', routines: [{ id: 'deleted' }], schedule: { week: { 1: 'own', 2: 'deleted', 3: 'assigned' }, dayPlan: { '2026-11-01': 'rest', '2026-11-02': null, '2026-11-03': 'own', '2026-11-04': 'deleted' } } } }])
  expect(preview).toMatchObject({ assignedProgram: null, planMode: 'daily', routines: [state.routines[0]], week: { 1: 'own' }, dayPlan: { '2026-11-01': 'rest', '2026-11-02': null, '2026-11-03': 'own' } })
  expect(state.week).toEqual({ 1: 'assigned' })
})
it('uses a safe empty calendar when no personal snapshot exists', () => {
  expect(personalPlanPreview(state, [])).toMatchObject({ routines: [state.routines[0]], week: {}, dayPlan: {}, planMode: 'weekly', assignedProgram: null })
})
it('represents the active personal state immediately without consulting stale snapshots', () => {
  const personal = { ...state, assignedProgram: null, routines: [state.routines[0]], week: { 3: 'own' }, dayPlan: { '2026-11-02': 'rest' }, planMode: 'daily' }
  expect(personalPlanPreview(personal, [])).toBe(personal)
})
