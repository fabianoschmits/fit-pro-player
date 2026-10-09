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
      name: String(version.workout_titles?.[dayKey] || '').trim() || String(rawPlan[dayKey]?.title || rawPlan[dayKey]?.name || '').trim() || `Treino recebido · ${dayKey}`,
      emoji: 'dumbbell',
      assigned: true,
      assignedDayKey: dayKey,
      assignmentId: assignment?.id || null,
      programVersionId: version.id,
      ex: (Array.isArray(entries) ? entries : entries.exercises || []).map(item => ({
        ...item,
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
    updatedAt: version.published_at || assignment?.created_at || null,
    receivedAt: new Date().toISOString(),
  }
  state.onboardingDone = true
  return state
}

export function hasAssignedProgram(state) {
  return Boolean(state?.assignedProgram?.versionId)
}

export function clearAssignedProgramFromState(state) {
  const assigned = new Set((state.routines || []).filter(routine => routine.assigned).map(routine => routine.id))
  state.routines = (state.routines || []).filter(routine => !routine.assigned)
  state.week = Object.fromEntries(Object.entries(state.week || {}).filter(([, id]) => !assigned.has(id)))
  state.dayPlan = Object.fromEntries(Object.entries(state.dayPlan || {}).filter(([, id]) => !assigned.has(id)))
  state.assignedProgram = null
  return state
}

export function assignedSessionEntries(routine, unit = 'kg') {
  return (routine?.ex || []).map(cfg => {
    const weight = cfg.unit && cfg.unit !== unit ? cfg.weight * (unit === 'lb' ? 2.2046226218 : 1 / 2.2046226218) : cfg.weight
    const sets = Array.from({ length: cfg.sets }, () => ({
      ...(cfg.mode === 'cardio' ? { min: cfg.min ?? 20, speed: cfg.speed ?? 8 } : cfg.mode === 'time' ? { sec: cfg.sec ?? 45, w: weight } : { w: weight, r: cfg.reps }),
      ...(cfg.rir != null ? { rir: cfg.rir } : {}), ...(cfg.rpe != null ? { rpe: cfg.rpe } : {}), done: false,
    }))
    return { id: cfg.id, sg: cfg.sg, target: { ...cfg, weight, unit }, plan: null, sets }
  })
}
