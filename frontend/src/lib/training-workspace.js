import { DAYS, normalizeWeeklyPlan } from './professional-program.js'
export function weeklyPlanToWorkspace(plan = {}, titles = {}) {
  const routines = [], week = {}
  Object.entries(normalizeWeeklyPlan(plan)).forEach(([day, entries]) => {
    const id = crypto.randomUUID()
    routines.push({ id, name: titles[day] || `Treino ${String.fromCharCode(65 + routines.length)}`, emoji: 'dumbbell', ex: entries.map(({ exerciseId, load, ...entry }) => ({ ...entry, id: exerciseId, weight: load })) })
    week[DAYS.indexOf(day)] = id
  })
  return { routines, week, dayPlan: {}, planMode: 'weekly', onboardingDone: true }
}
export function workspaceToWeeklyPlan(state) {
  const weeklyPlan = {}, workoutTitles = {}
  DAYS.forEach((day, index) => {
    const routine = state.routines.find(item => item.id === state.week[index])
    if (!routine?.ex.length) return
    weeklyPlan[day] = routine.ex.map(({ id, weight, ...entry }) => ({ ...entry, sets: entry.sets || 1, reps: entry.reps || 1, exerciseId: id, load: weight ?? 0 }))
    workoutTitles[day] = routine.name
  })
  return { weeklyPlan, workoutTitles }
}
