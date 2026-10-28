const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const FIELDS = ['sets', 'reps', 'load', 'rest', 'duration', 'distance', 'notes', 'mode', 'sec', 'min', 'speed', 'rir', 'rpe', 'unit', 'effort', 'sg']

const exercisesFor = (version, day) => (version?.weekly_plan?.[day] || version?.weeklyPlan?.[day] || []).map(exercise => ({ ...exercise, exerciseId: exercise.exerciseId || exercise.id }))
const titleFor = (version, day) => version?.workout_titles?.[day] || version?.workoutTitles?.[day] || 'Treino'
const value = input => input === undefined ? null : input

export function compareProfessionalPlanVersions(previousVersion, nextVersion) {
  const days = DAYS.map(day => {
    const previous = exercisesFor(previousVersion, day)
    const next = exercisesFor(nextVersion, day)
    const previousTitle = titleFor(previousVersion, day)
    const nextTitle = titleFor(nextVersion, day)
    if (!previous.length && !next.length) return null
    const type = !previous.length ? 'added' : !next.length ? 'removed' : 'changed'
    const previousById = new Map(previous.map(item => [item.exerciseId, item]))
    const nextById = new Map(next.map(item => [item.exerciseId, item]))
    const added = next.filter(item => !previousById.has(item.exerciseId))
    const removed = previous.filter(item => !nextById.has(item.exerciseId))
    const changed = next.filter(item => previousById.has(item.exerciseId)).map(item => {
      const before = previousById.get(item.exerciseId)
      const changes = FIELDS.filter(field => value(before[field]) !== value(item[field]))
        .map(field => ({ field, previous: value(before[field]), next: value(item[field]) }))
      return changes.length ? { exerciseId: item.exerciseId, changes } : null
    }).filter(Boolean)
    const previousOrder = previous.map(item => item.exerciseId)
    const nextOrder = next.map(item => item.exerciseId)
    const reordered = !added.length && !removed.length && previousOrder.join('|') !== nextOrder.join('|')
    const titleChanged = previous.length > 0 && next.length > 0 && previousTitle !== nextTitle
    if (type === 'changed' && !titleChanged && !added.length && !removed.length && !changed.length && !reordered) return null
    return { day, type, previousTitle, nextTitle, titleChanged, exercises: { added, removed, changed, reordered } }
  }).filter(Boolean)
  return {
    previousVersionId: previousVersion?.id || null,
    nextVersionId: nextVersion?.id || null,
    affectedDays: days.map(day => day.day),
    days,
  }
}
