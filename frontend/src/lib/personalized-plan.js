import { uid } from './format.js'
import { suggestedWeightFor } from './history.js'
import { EXERCISE_SPRITE_EXERCISE_IDS } from './exercise-guide-assets.js'
import { isBodyweightEq } from './exercises.js'
import { isStarterRoutine } from './starter.js'

const ACTIVE_IDS = new Set(EXERCISE_SPRITE_EXERCISE_IDS)

const TEMPLATES = {
  full: ['Full Body', 'dumbbell', ['0043', '0025', '0027', '0085', '0405', '0276']],
  full_a: ['Full Body A', 'dumbbell', ['0043', '0025', '0027', '0085', '0405', '0276']],
  full_b: ['Full Body B', 'dumbbell', ['0739', '0047', '0198', '0381', '0334', '0687']],
  upper: ['Upper Body', 'chest', ['0025', '0027', '0047', '0198', '0405', '0294', '0201']],
  lower: ['Lower Body', 'legs', ['0043', '0085', '0739', '0586', '0431', '0605', '0276']],
  push: ['Push Day', 'chest', ['0025', '0047', '0405', '0334', '0201', '0060']],
  pull: ['Pull Day', 'back', ['0652', '0027', '0861', '0238', '0294', '0313']],
  chest_triceps: ['Chest & Triceps', 'chest', ['0025', '0047', '0289', '0308', '0201', '0060']],
  back_biceps: ['Back & Biceps', 'back', ['0652', '0027', '0198', '0861', '0294', '0313']],
  legs_core: ['Legs & Core', 'legs', ['0043', '0085', '0739', '0585', '0586', '0605', '0276']],
  shoulders_abs: ['Shoulders & Abs', 'shoulders', ['1457', '0334', '0378', '0405', '0274', '0687']],
  arms_core: ['Arms & Core', 'arm', ['0294', '0201', '0313', '0060', '0447', '0351', '0276']],
  glutes_legs: ['Glutes & Legs', 'glutes', ['1409', '0043', '0085', '0381', '0431', '0586', '0710']],
  conditioning: ['Conditioning', 'bolt', ['1160', '0549', '0630', '3224', '0514', '2612']],
  cardio_core: ['Cardio & Core', 'heart', ['2612', '2138', '0630', '0003', '0276', '0687']],
  recovery: ['Active Recovery', 'heart', ['1604', '1511', '0669', '1377', '1494', '0276']],
  chest: ['Chest Day', 'chest', ['0025', '0047', '0289', '0308', '0251', '0314']],
  back: ['Back Day', 'back', ['0652', '0027', '0198', '0861', '0293', '0238']],
  legs: ['Leg Day', 'legs', ['0043', '0085', '0739', '0585', '0586', '0605']],
  abs: ['Abs Day', 'abs', ['0274', '0472', '0687', '0630', '0276', '0857']],
  arms: ['Arms Day', 'arm', ['0294', '0313', '0080', '0060', '0201', '0447']],
  shoulders: ['Shoulders Day', 'shoulders', ['1457', '0334', '0120', '0378', '2137', '0405']],
  glutes: ['Glutes Day', 'glutes', ['1409', '0043', '0085', '0381', '0431', '0586']],
}

const SPLITS = {
  build_muscle: {
    1: ['full'],
    2: ['upper', 'lower'],
    3: ['push', 'pull', 'legs_core'],
    4: ['chest_triceps', 'back_biceps', 'legs_core', 'shoulders_abs'],
    5: ['chest', 'back', 'legs', 'shoulders', 'arms'],
    6: ['chest', 'back', 'legs', 'shoulders', 'arms', 'glutes'],
    7: ['chest', 'back', 'legs', 'shoulders', 'arms', 'glutes', 'abs'],
  },
  lose_weight: {
    1: ['full'],
    2: ['full_a', 'full_b'],
    3: ['full_a', 'conditioning', 'full_b'],
    4: ['upper', 'lower', 'conditioning', 'full'],
    5: ['upper', 'lower', 'conditioning', 'full_a', 'cardio_core'],
    6: ['chest', 'back', 'legs', 'conditioning', 'full_a', 'full_b'],
    7: ['chest', 'back', 'legs', 'conditioning', 'shoulders', 'glutes', 'recovery'],
  },
  improve_fitness: {
    1: ['full'],
    2: ['full_a', 'conditioning'],
    3: ['full_a', 'conditioning', 'full_b'],
    4: ['upper', 'conditioning', 'lower', 'cardio_core'],
    5: ['full_a', 'conditioning', 'upper', 'lower', 'cardio_core'],
    6: ['chest', 'back', 'legs', 'conditioning', 'full', 'cardio_core'],
    7: ['chest', 'back', 'legs', 'conditioning', 'shoulders', 'glutes', 'recovery'],
  },
  maintain_weight: {
    1: ['full'],
    2: ['upper', 'lower'],
    3: ['full', 'upper', 'lower'],
    4: ['upper', 'lower', 'push', 'pull'],
    5: ['chest', 'back', 'legs', 'shoulders', 'full'],
    6: ['chest', 'back', 'legs', 'shoulders', 'arms', 'glutes'],
    7: ['chest', 'back', 'legs', 'shoulders', 'arms', 'glutes', 'recovery'],
  },
}

const DAILY_KEYS = ['chest', 'back', 'legs', 'abs', 'arms', 'shoulders', 'glutes']
const FINISHERS = ['1160', '2612', '0630', '3224']
const TIMED_IDS = new Set(['1160', '2612', '0630', '3224', '0514', '1604', '1511', '0669', '1377', '1494'])
const EXPERIENCE_FACTOR = { beginner: 0.7, intermediate: 0.9, advanced: 1.05 }
const GOAL_FACTOR = { lose_weight: 0.72, build_muscle: 1, improve_fitness: 0.78, maintain_weight: 0.9 }
const EXERCISE_LIMIT = { beginner: 4, intermediate: 5, advanced: 6 }

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

function exerciseIdsFor(key, goal, experience, dayCount, templateIndex) {
  const base = TEMPLATES[key][2]
  let limit = EXERCISE_LIMIT[experience]
  if (dayCount <= 2) limit++
  if (key === 'conditioning' || key === 'cardio_core') limit = Math.max(limit, 5)
  if (key === 'recovery') limit = 5
  const ids = base.slice(0, Math.min(base.length, limit))

  if ((goal === 'lose_weight' || goal === 'improve_fitness') && !['conditioning', 'cardio_core', 'recovery'].includes(key)) {
    let finisher = FINISHERS[templateIndex % FINISHERS.length]
    if (ids.includes(finisher)) finisher = FINISHERS[(templateIndex + 1) % FINISHERS.length]
    if (ids.length >= limit) ids[ids.length - 1] = finisher
    else ids.push(finisher)
  }
  return [...new Set(ids)].filter(id => ACTIVE_IDS.has(id))
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
    return { id, sets: 1, mode: 'time', sec: experience === 'beginner' ? 30 : 40, weight: 0, bodyweight: true, prog: 'off' }
  }
  if (TIMED_IDS.has(id)) {
    const sec = experience === 'beginner' ? 30 : experience === 'advanced' ? 50 : 40
    return { id, sets: goal === 'lose_weight' && experience !== 'beginner' ? 3 : 2, mode: 'time', sec, weight: 0, bodyweight: true, prog: 'time' }
  }
  if (id === '2138') {
    return { id, sets: 1, mode: 'cardio', min: experience === 'beginner' ? 10 : experience === 'advanced' ? 20 : 15, speed: 7 }
  }

  let sets = { beginner: 2, intermediate: 3, advanced: 4 }[experience]
  if (index === 0 && goal === 'build_muscle') sets = Math.min(5, sets + 1)
  if (dayCount >= 5 && index >= 3) sets = Math.max(2, sets - 1)
  const reps = repTarget(goal, experience, index)
  const baseWeight = bodyweight ? 0 : suggestedWeightFor(state, id)
  const weight = snapLoad(baseWeight * EXPERIENCE_FACTOR[experience] * GOAL_FACTOR[goal])
  return {
    id, sets, reps: reps.max, repsMin: reps.min, repsMax: reps.max, weight,
    ...(bodyweight ? { bodyweight: true } : {}),
    prog: goal === 'build_muscle' || goal === 'maintain_weight' ? 'double' : 'linear',
  }
}

/** Pure plan description used by both the wizard preview and the persisted routines. */
export function personalizedRoutineSpecs(profile = {}, dayCount = 3, options = {}) {
  const goal = validGoal(profile.goal)
  const experience = validExperience(profile.experience)
  const count = options.daily ? 7 : Math.max(1, Math.min(7, Math.round(dayCount) || 1))
  const keys = splitKeys(goal, count, options.daily)
  const state = {
    ...(options.state || {}),
    bodyweight: [{ d: 'profile', w: Number(profile.startWeight) || 70, t: 0 }],
    targetW: Number(profile.startWeight) || 70,
  }

  return keys.map((key, templateIndex) => {
    const [starterKey, emoji] = TEMPLATES[key]
    const ids = exerciseIdsFor(key, goal, experience, count, templateIndex)
    return {
      personalizedKey: key,
      starterKey,
      emoji,
      planGenerated: true,
      planGoal: goal,
      planExperience: experience,
      prog: goal === 'build_muscle' || goal === 'maintain_weight' ? 'double' : 'linear',
      ex: ids.map((id, index) => exerciseConfig(id, index, {
        goal, experience, dayCount: count, state, recovery: key === 'recovery',
      })),
    }
  })
}

const managedRoutine = routine => !routine?.starterCustomName && (routine?.planGenerated || isStarterRoutine(routine))

/** Replace only app-managed routines, preserving custom routines and reusing ids where possible. */
export function applyPersonalizedPlan(state, profile, dayCount, options = {}) {
  const specs = personalizedRoutineSpecs(profile, dayCount, { ...options, state })
  const managed = (state.routines || []).filter(managedRoutine)
  const custom = (state.routines || []).filter(routine => !managedRoutine(routine))
  const unused = [...managed]
  const routines = specs.map(spec => {
    const exactIndex = unused.findIndex(routine => routine.personalizedKey === spec.personalizedKey || routine.starterKey === spec.starterKey)
    const existing = exactIndex >= 0 ? unused.splice(exactIndex, 1)[0] : unused.shift()
    return { ...spec, id: existing?.id || uid(), name: spec.starterKey }
  })
  const replacements = new Map(managed.map((routine, index) => [routine.id, routines[index % routines.length]?.id]))
  Object.keys(state.dayPlan || {}).forEach(date => {
    const nextId = replacements.get(state.dayPlan[date])
    if (nextId) state.dayPlan[date] = nextId
  })
  state.routines = [...routines, ...custom]
  state.restSec = personalizedRestSeconds(profile.goal, profile.experience)
  return routines
}
