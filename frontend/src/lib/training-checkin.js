import { compareTraining, normalizeTrainingComparison, snapshotTrainingEntries } from './training-comparison.js'
import { CHECKIN_REASON_LABELS, TRAINING_CHECKIN_REASONS, normalizeTrainingCheckin } from './training-checkin-data.js'
export { normalizeTrainingCheckin } from './training-checkin-data.js'
export const TRAINING_CHANGE_TYPES = { SIGNIFICANT_SET_REDUCTION: 'significant_set_reduction', SIGNIFICANT_SET_INCREASE: 'significant_set_increase', SKIPPED_EXERCISE: 'skipped_exercise', ADDED_EXERCISE: 'added_exercise', REPLACED_EXERCISE: 'replaced_exercise' }
export const TRAINING_CHANGE_LIMITS = { ratio: 0.2, minimumSets: 2, addedExerciseSets: 1 }
const completed = workout => !!workout && Array.isArray(workout.entries) && !['active', 'cancelled', 'discarded', 'abandoned', 'draft'].includes(workout.status)
const group = entries => {
 const counts = new Map()
 for (const entry of entries) counts.set(entry.exerciseId, (counts.get(entry.exerciseId) || 0) + entry.workSets)
 return counts
}
export function detectTrainingChanges(workout) {
 const comparison = compareTraining(workout), snapshots = normalizeTrainingComparison(workout?.comparison)
 // compareTraining deliberately has no original-plan fallback without a confirmed adjustment.
 const eligible = completed(workout) && comparison.reference === 'adjusted'
 const plannedSets = eligible ? comparison.summary.referenceSets : null, completedSets = comparison.summary.actualSets
 const reference = group(snapshots?.adjusted || [])
 const actual = group(snapshotTrainingEntries((Array.isArray(workout?.entries) ? workout.entries : []).filter(Boolean).map(entry => ({ ...entry, sets: (Array.isArray(entry.sets) ? entry.sets : []).filter(row => row?.done === true) }))))
 const changes = { plannedSets, completedSets, missingSets: eligible ? Math.max(0, plannedSets - completedSets) : 0, addedSets: eligible ? Math.max(0, completedSets - plannedSets) : 0,
  skippedExercises: [], addedExercises: [], replacedExercises: [], reducedExercises: [], increasedExercises: [] }
 const triggers = []
 if (eligible) {
  for (const [id, count] of reference) {
   const done = actual.get(id) || 0
   const occurrences = (snapshots.adjusted || []).filter(item => item.exerciseId === id && item.workSets > 0).length
   const performed = snapshotTrainingEntries((workout.entries || []).filter(item => item?.id === id).map(item => ({ ...item, sets: (Array.isArray(item.sets) ? item.sets : []).filter(row => row?.done === true) }))).filter(item => item.workSets > 0).length
   if (count > 0 && performed < occurrences) changes.skippedExercises.push(id)
   if (done < count) changes.reducedExercises.push(id)
   if (done > count) changes.increasedExercises.push(id)
  }
  for (const [id, count] of actual) if (!reference.has(id) && count >= TRAINING_CHANGE_LIMITS.addedExerciseSets) changes.addedExercises.push(id)
  // Only explicit session replacement links establish a replacement. A removed
  // movement and an unrelated addition are intentionally kept separate.
  changes.replacedExercises = (workout.entries || []).filter(entry => entry.replacedFrom && reference.has(entry.replacedFrom) && entry.replacedFrom !== entry.id).map(entry => ({ from: entry.replacedFrom, to: entry.id }))
  if (changes.missingSets >= TRAINING_CHANGE_LIMITS.minimumSets && changes.missingSets / plannedSets >= TRAINING_CHANGE_LIMITS.ratio) triggers.push(TRAINING_CHANGE_TYPES.SIGNIFICANT_SET_REDUCTION)
  if (changes.addedSets >= TRAINING_CHANGE_LIMITS.minimumSets && changes.addedSets / plannedSets >= TRAINING_CHANGE_LIMITS.ratio) triggers.push(TRAINING_CHANGE_TYPES.SIGNIFICANT_SET_INCREASE)
  if (changes.skippedExercises.length) triggers.push(TRAINING_CHANGE_TYPES.SKIPPED_EXERCISE)
  if (changes.addedExercises.length) triggers.push(TRAINING_CHANGE_TYPES.ADDED_EXERCISE)
  if (changes.replacedExercises.length) triggers.push(TRAINING_CHANGE_TYPES.REPLACED_EXERCISE)
 }
 return { eligible, reference: eligible ? 'adjusted' : null, changes, triggers, shouldPrompt: eligible && triggers.length > 0 && !normalizeTrainingCheckin(workout?.checkIn) }
}
export function orderedCheckinReasons(detection, flexApplied = false) {
 const changes = detection.changes
 const first = changes.replacedExercises.length ? ['equipment_unavailable', 'personal_preference', 'pain_or_discomfort', 'professional_guidance']
  : changes.addedSets > 0 ? ['felt_good_to_continue', 'training_felt_easy', 'personal_preference', 'professional_guidance']
  : ['time_constraint', 'fatigue', 'equipment_unavailable', 'pain_or_discomfort', 'unexpected_event', 'personal_preference']
 return [...new Set([...first, ...(flexApplied ? ['flex_adjustment'] : []), ...TRAINING_CHECKIN_REASONS])]
}
export function withTrainingCheckin(state, workoutId, input, now, operationId) {
 const workout = state.workouts?.find(item => item.id === workoutId)
 if (!completed(workout)) throw new Error('training-checkin-workout-unavailable')
 const previous = normalizeTrainingCheckin(state.trainingCheckIns?.[workoutId])
 const value = normalizeTrainingCheckin({ ...input, version: 1, sharing: 'private', operationId, updatedAt: now,
  ...(input.status === 'answered' ? { answeredAt: previous?.answeredAt || now } : input.status === 'removed' ? { removedAt: now } : { dismissedAt: now }) })
 if (!value) throw new Error('training-checkin-empty-response')
 return { ...state, trainingCheckIns: { ...state.trainingCheckIns, [workoutId]: value } }
}
export function buildWeeklyCheckinSummary(workouts = []) {
 const counts = new Map(), seen = new Set(); let answeredWorkouts = 0
 for (const workout of workouts) {
  if (!workout?.id || seen.has(workout.id)) continue
  seen.add(workout.id)
  const answer = normalizeTrainingCheckin(workout.checkIn)
  if (answer?.status !== 'answered') continue
  answeredWorkouts++
  for (const reason of answer.reasons) counts.set(reason, (counts.get(reason) || 0) + 1)
 }
 return { answeredWorkouts, reasons: TRAINING_CHECKIN_REASONS.filter(reason => counts.has(reason)).map(reason => ({ reason, count: counts.get(reason) })).sort((a, b) => b.count - a.count) }
}
export const checkinReasonLabel = reason => CHECKIN_REASON_LABELS[reason] || CHECKIN_REASON_LABELS.other
