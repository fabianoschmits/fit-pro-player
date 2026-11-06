import { uid } from './format.js'
import { suggestedWeightFor } from './history.js'
import { EXERCISE_SPRITE_EXERCISE_IDS } from './exercise-guide-assets.js'
import { isBodyweightEq } from './exercises.js'
import { estimateWorkoutDuration, fitWorkoutToMinutes } from './workout-duration.js'
import { normalizePreferredWorkoutMinutes } from './profile.js'
import { TRAINING_TEMPLATES as TEMPLATES, TRAINING_CARDIO_IDS, TRAINING_TIMED_IDS } from './training-templates.js'

export const prescriptionSignature = exercises => JSON.stringify(exercises, (_key, value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value)

const ACTIVE_IDS = new Set(EXERCISE_SPRITE_EXERCISE_IDS)


const SPLITS = {
  build_muscle: {
    1: ['full'],
    2: ['full_a', 'full_b'],
    3: ['upper', 'lower', 'full'],
    4: ['upper', 'lower', 'full_a', 'full_b'],
    5: ['upper', 'lower', 'chest_triceps', 'back_biceps', 'legs_core'],
    6: ['push', 'pull', 'legs_core', 'chest_triceps', 'back_biceps', 'glutes_legs'],
    7: ['upper', 'lower', 'chest_triceps', 'back_biceps', 'legs_core', 'shoulders_abs', 'recovery'],
  },
  lose_weight: {
    1: ['full'],
    2: ['full_a', 'full_b'],
    3: ['full_a', 'conditioning', 'full_b'],
    4: ['upper', 'lower', 'conditioning', 'full'],
    5: ['upper', 'lower', 'conditioning', 'full_a', 'cardio_core'],
    6: ['chest', 'back', 'legs', 'conditioning', 'full_a', 'full_b'],
    7: ['upper', 'lower', 'full_a', 'conditioning', 'full_b', 'cardio_core', 'recovery'],
  },
  improve_fitness: {
    1: ['full'],
    2: ['full_a', 'full_b'],
    3: ['full_a', 'conditioning', 'full_b'],
    4: ['upper', 'conditioning', 'lower', 'full_b'],
    5: ['full_a', 'conditioning', 'upper', 'lower', 'cardio_core'],
    6: ['chest', 'back', 'legs', 'conditioning', 'full', 'cardio_core'],
    7: ['upper', 'lower', 'full_a', 'conditioning', 'full_b', 'cardio_core', 'recovery'],
  },
  maintain_weight: {
    1: ['full'],
    2: ['full_a', 'full_b'],
    3: ['full', 'upper', 'lower'],
    4: ['upper', 'lower', 'full_a', 'full_b'],
    5: ['chest', 'back', 'legs', 'shoulders', 'full'],
    6: ['push', 'pull', 'legs_core', 'chest_triceps', 'back_biceps', 'glutes_legs'],
    7: ['upper', 'lower', 'chest_triceps', 'back_biceps', 'legs_core', 'shoulders_abs', 'recovery'],
  },
}

const DAILY_KEYS = ['chest', 'back', 'legs', 'abs', 'arms', 'shoulders', 'glutes', ...Object.keys(TEMPLATES).filter(key => !['chest', 'back', 'legs', 'abs', 'arms', 'shoulders', 'glutes'].includes(key))]
const TIMED_IDS = TRAINING_TIMED_IDS
const EXPERIENCE_FACTOR = { beginner: 0.7, intermediate: 0.9, advanced: 1.05 }
const GOAL_FACTOR = { lose_weight: 0.72, build_muscle: 1, improve_fitness: 0.78, maintain_weight: 0.9 }
const EXERCISE_LIMIT = { beginner: 6, intermediate: 7, advanced: 8 }

const validGoal = goal => SPLITS[goal] ? goal : 'maintain_weight'
const validExperience = experience => EXPERIENCE_FACTOR[experience] ? experience : 'beginner'
const snapLoad = value => value > 0 ? Math.max(2.5, Math.round(value / 2.5) * 2.5) : 0

export function personalizedRestSeconds(goal, experience) {
  const g = validGoal(goal)
  const e = validExperience(experience)
  if (g === 'build_muscle') return e === 'advanced' ? 120 : 90
  if (g === 'maintain_weight') return e === 'beginner' ? 60 : 75
  if (g === 'improve_fitness') return e === 'beginner' ? 45 : 60
  return e === 'advanced' ? 60 : 45
}

export function splitKeys(goal, dayCount, daily = false) {
  if (daily) return [...DAILY_KEYS]
  const count = Math.max(1, Math.min(7, Math.round(dayCount) || 1))
  return [...SPLITS[validGoal(goal)][count]]
}

function exerciseIdsFor(key, experience) {
  // Aerobic work is budgeted explicitly below, never treated as repetitions.
  return TEMPLATES[key][2].filter(id => ACTIVE_IDS.has(id) && !TRAINING_CARDIO_IDS.has(id))
    .slice(0, EXERCISE_LIMIT[experience])
}

function repTarget(goal, experience, index) {
  if (goal === 'build_muscle') {
    if (index === 0) return experience === 'advanced' ? { min: 6, max: 8 } : { min: 8, max: 10 }
    return { min: 10, max: 12 }
  }
  if (goal === 'lose_weight') return { min: index === 0 ? 10 : 12, max: index === 0 ? 12 : 15 }
  if (goal === 'improve_fitness') return { min: 10, max: 14 }
  return { min: index === 0 ? 8 : 10, max: index === 0 ? 10 : 12 }
}

function exerciseConfig(id, index, context) {
  const { goal, experience, dayCount, state, recovery } = context
  const bodyweight = isBodyweightEq(id)
  if (recovery) {
    return { id, sets: 1, rest: 30, mode: 'time', sec: experience === 'beginner' ? 30 : 40, weight: 0, bodyweight: true, prog: 'off' }
  }
  if (TIMED_IDS.has(id)) {
    const sec = experience === 'beginner' ? 30 : experience === 'advanced' ? 50 : 40
    return { id, rest: 45, sets: goal === 'lose_weight' && experience !== 'beginner' ? 3 : 2, mode: 'time', sec, weight: 0, bodyweight: true, prog: 'time' }
  }
  if (TRAINING_CARDIO_IDS.has(id)) {
    return { id, sets: 1, mode: 'cardio', min: experience === 'beginner' ? 10 : experience === 'advanced' ? 20 : 15, speed: 7 }
  }

  let sets = { beginner: 3, intermediate: 3, advanced: 4 }[experience]
  if (index === 0 && goal === 'build_muscle' && experience !== 'beginner') sets = Math.min(4, sets + 1)
  if (dayCount >= 5 && index >= 3) sets = Math.max(2, sets - 1)
  const reps = repTarget(goal, experience, index)
  const baseWeight = bodyweight ? 0 : suggestedWeightFor(state, id)
  const weight = snapLoad(baseWeight * EXPERIENCE_FACTOR[experience] * GOAL_FACTOR[goal])
  return {
    id, sets, rest: goal === 'build_muscle' ? (index < 2 ? 120 : 90) : (index < 2 ? 90 : 60), reps: reps.max, repsMin: reps.min, repsMax: reps.max, weight,
    ...(bodyweight ? { bodyweight: true } : {}),
    prog: goal === 'build_muscle' || goal === 'maintain_weight' ? 'double' : 'linear',
  }
}

/** Pure plan description used by both the wizard preview and the persisted routines. */
export function personalizedRoutineSpecs(profile = {}, dayCount = 3, options = {}) {
  const goal = validGoal(profile.goal)
  const experience = validExperience(profile.experience)
  const count = options.daily ? 7 : Math.max(1, Math.min(7, Math.round(dayCount) || 1))
  const keys = options.keys ? options.keys.filter(key => TEMPLATES[key]) : splitKeys(goal, count, options.daily)
  const state = {
    ...(options.state || {}),
    bodyweight: [{ d: 'profile', w: Number(profile.startWeight) || 70, t: 0 }],
    targetW: Number(profile.startWeight) || 70,
  }

  return keys.map(key => {
    const [starterKey, emoji] = TEMPLATES[key]
    const ids = exerciseIdsFor(key, experience)
    const candidates = ids.map((id, index) => exerciseConfig(id, index, {
      goal, experience, dayCount: count, state, recovery: key === 'recovery',
    }))
    let excessSets = candidates.reduce((sum, exercise) => sum + exercise.sets, 0) - ({ beginner: 18, intermediate: 22, advanced: 26 }[experience])
    for (let index = candidates.length - 1; index >= 0 && excessSets > 0; index--) {
      const reduction = Math.min(excessSets, Math.max(0, candidates[index].sets - 2))
      candidates[index].sets -= reduction
      excessSets -= reduction
    }
    const target = normalizePreferredWorkoutMinutes(profile.preferredWorkoutMinutes)
    const aerobicFraction = { build_muscle: 0.12, lose_weight: 0.4, improve_fitness: 0.35, maintain_weight: 0.25 }[goal]
    const cardioFocused = ['conditioning', 'cardio_core', 'recovery'].includes(key)
    // Reserve an actual, executable moderate aerobic block. Short strength sessions
    // prioritize their main movements; long sessions never inflate sets to fill time.
    const aerobicBudget = target >= 30 ? Math.round(target * (cardioFocused ? 0.6 : aerobicFraction)) : 0
    const strengthTarget = Math.max(15, Math.floor((target - aerobicBudget) / 5) * 5)
    const fitted = fitWorkoutToMinutes(candidates, strengthTarget, { goal })
    const exercises = fitted.selectedIndices.map(index => candidates[index])
    const withBike = [...exercises, { id: '2138', sets: 1, mode: 'cardio', min: 1, rest: 0 }]
    const remaining = Math.floor((target * 60 - estimateWorkoutDuration(withBike)) / 60) + 1
    if (remaining >= 5 && target >= 30) {
      exercises.push({ ...withBike[withBike.length - 1], min: Math.min(60, remaining) })
    }

    return {
      personalizedKey: key,
      starterKey,
      emoji,
      planGenerated: true,
      planTemplateVersion: 2,
      planTargetMinutes: target,
      planGoal: goal,
      planExperience: experience,
      prog: goal === 'build_muscle' || goal === 'maintain_weight' ? 'double' : 'linear',
      ex: exercises,
      planSignature: prescriptionSignature(exercises),
    }
  })
}

// A persisted signature proves that a generated prescription is still app-owned.
// Legacy generated lists without that evidence are preserved on duration-only edits.
export const isManagedPersonalizedRoutine = routine => !routine?.assigned && !routine?.starterCustomName
  && routine?.planGenerated === true && typeof routine.planSignature === 'string'
  && routine.planSignature === prescriptionSignature(routine.ex || [])

/** Refit only proven app-owned routines, keeping schedules, active work and manual plans. */
export function refreshManagedPersonalizedPlan(state) {
  const daily = state.planMode === 'daily'
  const scheduled = new Set(Object.values(state.week || {}).filter(Boolean))
  const count = daily ? 7 : Math.max(1, Math.min(7, scheduled.size || (state.routines || []).filter(isManagedPersonalizedRoutine).length || 3))
  const specs = personalizedRoutineSpecs(state.profile, count, { daily, state, keys: [...new Set((state.routines || []).filter(isManagedPersonalizedRoutine).map(routine => routine.personalizedKey))] })
  state.routines = (state.routines || []).map(routine => {
    if (!isManagedPersonalizedRoutine(routine) || state.active?.routineId === routine.id) return routine
    const spec = specs.find(candidate => candidate.personalizedKey === routine.personalizedKey)
    return spec ? { ...routine, ...spec } : routine
  })
  return state.routines
}

/** Replace only app-managed routines, preserving custom routines and reusing ids where possible. */
export function applyPersonalizedPlan(state, profile, dayCount, options = {}) {
  const specs = personalizedRoutineSpecs(profile, dayCount, { ...options, state })
  const canReplace = routine => isManagedPersonalizedRoutine(routine) && state.active?.routineId !== routine.id
  const managed = (state.routines || []).filter(canReplace)
  const custom = (state.routines || []).filter(routine => !canReplace(routine))
  const unused = [...managed]
  const routines = specs.map(spec => {
    const exactIndex = unused.findIndex(routine => routine.personalizedKey === spec.personalizedKey || routine.starterKey === spec.starterKey)
    const existing = exactIndex >= 0 ? unused.splice(exactIndex, 1)[0] : unused.shift()
    return { ...spec, id: existing?.id || uid(), name: spec.starterKey }
  })
  const retainedIds = new Set(routines.map(routine => routine.id))
  const replacements = new Map(managed.filter(routine => !retainedIds.has(routine.id))
    .map((routine, index) => [routine.id, routines[index % routines.length]?.id]))
  Object.keys(state.dayPlan || {}).forEach(date => {
    const nextId = replacements.get(state.dayPlan[date])
    if (nextId) state.dayPlan[date] = nextId
  })
  state.routines = [...routines, ...custom]
  state.restSec = personalizedRestSeconds(profile.goal, profile.experience)
  return routines
}
