import { normalizeWeeklyPlan } from './professional-program.js'

const DAYS = [
  ['sunday', 0], ['monday', 1], ['tuesday', 2], ['wednesday', 3],
  ['thursday', 4], ['friday', 5], ['saturday', 6],
]

const dayNumber = key => {
  if (Number.isInteger(Number(key))) return Number(key)
  const found = DAYS.find(([name]) => name === String(key).toLowerCase())
  return found ? found[1] : null
}

export function assignedPlanToState(state, version, assignment) {
  const rawPlan = version?.weekly_plan && typeof version.weekly_plan === 'object' ? version.weekly_plan : {}
  const plan = normalizeWeeklyPlan(rawPlan)
  const routines = []
  const week = {}
  Object.entries(plan).forEach(([dayKey, entries], index) => {
    const day = dayNumber(dayKey)
    if (day == null || !Array.isArray(entries) || !entries.length) return
    const routine = {
      id: `assigned:${version.id}:${day}:${index}`,
      name: String(rawPlan[dayKey]?.title || rawPlan[dayKey]?.name || `Treino recebido · ${dayKey}`),
      emoji: 'dumbbell',
      assigned: true,
      assignmentId: assignment?.id || null,
      programVersionId: version.id,
      ex: (Array.isArray(entries) ? entries : entries.exercises || []).map(item => ({
        id: String(item.exerciseId || item.id || ''),
        sets: Math.max(1, Number(item.sets) || 1),
        reps: Math.max(1, Number(item.reps) || 10),
        weight: Math.max(0, Number(item.load ?? item.weight) || 0),
        ...(item.mode ? { mode: item.mode } : {}),
        ...(item.rest != null ? { rest: Number(item.rest) || 0 } : {}),
        ...(item.notes ? { notes: String(item.notes).slice(0, 500) } : {}),
      })).filter(item => item.id),
    }
    if (!routine.ex.length) return
    routines.push(routine)
    week[day] = routine.id
  })
  if (!routines.length) return state
  state.week = week
  state.dayPlan = {}
  state.planMode = 'weekly'
  state.routines = [...(state.routines || []).filter(item => !item?.assigned), ...routines]
  state.assignedProgram = {
    assignmentId: assignment?.id || null,
    programId: assignment?.program_id || null,
    versionId: version.id,
    versionNumber: version.version_number,
    receivedAt: new Date().toISOString(),
  }
  state.onboardingDone = true
  return state
}

export function hasAssignedProgram(state) {
  return Boolean(state?.assignedProgram?.versionId)
}
