/** A read-only projection of the existing server library, never a second plan store. */
export function personalPlanPreview(state, library) {
  if (!state.assignedProgram) return state
  const routines = state.routines.filter(routine => !routine.assigned)
  const ids = new Set(routines.map(routine => routine.id))
  const personal = library.filter(item => item.source_type === 'self')
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')) || String(a.id).localeCompare(String(b.id)))[0]?.personal_plan
  const entries = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : []
  return { ...state, assignedProgram: null, routines, planMode: personal?.mode === 'daily' ? 'daily' : 'weekly',
    week: Object.fromEntries(entries(personal?.schedule?.week).filter(([, id]) => ids.has(id))),
    dayPlan: Object.fromEntries(entries(personal?.schedule?.dayPlan).filter(([, id]) => id === null || id === 'rest' || ids.has(id))),
  }
}
