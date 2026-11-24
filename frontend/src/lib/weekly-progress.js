import { compareTraining, snapshotTrainingEntries, thresholdsOf } from './training-comparison.js'
import { MUSCLES, levelsOf } from './muscles.js'
import { buildWeeklyBase, completedWeeklyRows, weeklyEntries, workoutCalendarDate } from './weekly-progress-core.js'
import { buildWeeklyPerformance } from './weekly-progress-performance.js'
import { buildWeeklyInsights } from './weekly-progress-insights.js'
export { buildWeeklyPreview, buildMetricDelta } from './weekly-progress-core.js'

export function buildWeeklyProgress(options = {}) {
  const { records, cache, ...summary } = buildWeeklyBase(options)
  const actualLoad = Object.fromEntries(MUSCLES.map(id => [id, 0]))
  const directSets = Object.fromEntries(MUSCLES.map(id => [id, 0]))
  const related = Object.fromEntries(MUSCLES.map(id => [id, { exerciseIds: new Set(), workoutIds: new Set() }]))
  const unverifiedDirect = new Set()
  let estimatedMuscleSets = 0
  let unknownMuscleSets = 0, snapshotWorkouts = 0, eligibleWorkouts = 0, originalSets = 0, adjustedSets = 0, actualSets = 0, flexWorkouts = 0
  const normalizedWorkouts = []
  const catalog = options.exerciseCatalog instanceof Map ? options.exerciseCatalog : options.exerciseCatalog ? new Map(Object.entries(options.exerciseCatalog)) : null
  for (const workout of summary.workouts) {
    const entries = weeklyEntries(workout)
    const snapshots = snapshotTrainingEntries(entries, catalog ? id => catalog.get(id) : undefined)
    const comparison = compareTraining({ ...workout, entries: entries.map((entry, index) => ({ ...entry, muscleSnapshot: { muscleWeights: snapshots[index]?.muscleWeights || {} } })) })
    if (comparison.hasComparison) snapshotWorkouts++
    if (comparison.flexApplied) flexWorkouts++
    if (comparison.hasPlanned && comparison.hasAdjusted && comparison.summary.adjustedSets > 0) {
      eligibleWorkouts++; originalSets += comparison.summary.plannedSets; adjustedSets += comparison.summary.adjustedSets; actualSets += comparison.summary.actualSets
    }
    for (const id of MUSCLES) actualLoad[id] += comparison.loads.actual[id]
    entries.forEach((entry, index) => {
      const count = completedWeeklyRows(entry).length
      if (!count) return
      const weights = snapshots[index]?.muscleWeights || {}
      const known = MUSCLES.filter(id => weights[id] > 0)
      if (!known.length) unknownMuscleSets += count
      const historical = entry.muscleSnapshot !== null && typeof entry.muscleSnapshot === 'object'
      if (known.length && !historical) estimatedMuscleSets += count
      for (const id of known) {
        if (!historical) unverifiedDirect.add(id)
        else if (weights[id] === 1) directSets[id] += count
        related[id].exerciseIds.add(entry.id); related[id].workoutIds.add(workout.id)
      }
    })
    normalizedWorkouts.push({ ...workout, date: cache.get(workout).date, metrics: cache.get(workout).detail, hasPlanning: comparison.hasPlanned, origin: comparison.origin || (workout.assignmentId ? 'professional' : 'personal') })
  }
  for (const id of unverifiedDirect) directSets[id] = null
  const thresholds = thresholdsOf({ actual: actualLoad })
  const ranking = MUSCLES.filter(id => actualLoad[id] > 0).sort((a, b) => actualLoad[b] - actualLoad[a] || MUSCLES.indexOf(a) - MUSCLES.indexOf(b))
    .map(id => ({ id, load: actualLoad[id], directSets: directSets[id], exerciseIds: [...related[id].exerciseIds], workoutIds: [...related[id].workoutIds] }))
  const result = { ...summary, metrics: { ...summary.metrics, muscleGroupsWorked: ranking.length },
    muscles: { actualLoad, levels: levelsOf(actualLoad, thresholds), thresholds, directSets, ranking, unknownMuscleSets, estimatedMuscleSets },
    planning: { eligibleWorkouts, totalWorkouts: summary.metrics.workouts, originalSets: eligibleWorkouts ? originalSets : null,
      adjustedSets: eligibleWorkouts ? adjustedSets : null, actualSets: eligibleWorkouts ? actualSets : null,
      originalCompletion: originalSets > 0 ? actualSets / originalSets * 100 : null, adjustedCompletion: adjustedSets > 0 ? actualSets / adjustedSets * 100 : null, flexWorkouts },
    performance: { improvements: [], personalRecords: [] }, insights: [],
    workouts: normalizedWorkouts.sort((a, b) => b.date.localeCompare(a.date) || Number(b.end || b.start || 0) - Number(a.end || a.start || 0) || a.id.localeCompare(b.id)),
    coverage: { legacyWorkouts: summary.metrics.workouts - snapshotWorkouts, snapshotWorkouts, unknownDurationWorkouts: summary.metrics.workouts - summary.metrics.durationKnownWorkouts, unknownMuscleSets, estimatedMuscleSets } }
  result.performance = buildWeeklyPerformance({ ...options, workouts: records, weekStart: summary.period.start })
  result.insights = buildWeeklyInsights({ ...result, hasEarlierHistory: records.some(workout => workoutCalendarDate(workout, summary.period.timeZone) < summary.period.start) })
  return result
}
