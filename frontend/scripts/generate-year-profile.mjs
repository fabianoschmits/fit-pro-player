import fs from 'node:fs'
import path from 'node:path'

const DAY = 86400000
const round1 = value => Math.round(value * 10) / 10
const clamp = (min, value, max) => Math.min(max, Math.max(min, value))
const isoDate = date => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
const dayNumber = iso => {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / DAY
}
const dateFromDay = day => isoDate(new Date(day * DAY))
const weekday = iso => new Date(`${iso}T12:00:00Z`).getUTCDay()
const at = (iso, hour, minute) => new Date(`${iso}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-03:00`).getTime()
const weekKey = iso => dateFromDay(dayNumber(iso) - ((weekday(iso) + 6) % 7))
const roundLoad = (value, step) => Math.max(step, Math.round(value / step) * step)

const ROUTINES = [
  {
    id: 'year-push', name: 'Push pesado', emoji: 'chest', weekday: 1,
    ex: [
      ['0025', 4, 6], ['0047', 4, 8], ['0091', 4, 8],
      ['0334', 3, 12], ['0060', 3, 10], ['0201', 3, 12],
    ],
  },
  {
    id: 'year-pull', name: 'Pull pesado', emoji: 'back', weekday: 2,
    ex: [
      ['0652', 4, 8], ['0027', 4, 8], ['2330', 4, 10],
      ['1323', 3, 10], ['0293', 3, 10], ['0031', 3, 10],
    ],
  },
  {
    id: 'year-legs-a', name: 'Pernas — força', emoji: 'legs', weekday: 3,
    ex: [
      ['0043', 4, 6], ['0085', 4, 8], ['0739', 4, 10],
      ['0585', 3, 12], ['0586', 3, 12], ['0605', 4, 12],
    ],
  },
  {
    id: 'year-upper', name: 'Upper — volume', emoji: 'shoulders', weekday: 5,
    ex: [
      ['0289', 4, 8], ['0314', 3, 10], ['0027', 3, 10, .9],
      ['2330', 3, 12, .9], ['2137', 3, 10], ['0313', 3, 12],
    ],
  },
  {
    id: 'year-legs-b', name: 'Pernas e core — volume', emoji: 'glutes', weekday: 6,
    ex: [
      ['1409', 4, 8], ['0043', 3, 10, .82], ['0054', 3, 10],
      ['0431', 3, 12], ['0586', 3, 12, .9], ['0472', 3, 12], ['0687', 3, 16],
    ],
  },
]

const LOADS = {
  '0025': [60, 105, 2.5], '0047': [45, 80, 2.5], '0091': [35, 65, 2.5],
  '0334': [8, 16, 1], '0060': [20, 42.5, 2.5], '0201': [25, 50, 2.5],
  '0652': [0, 0, 1], '0027': [55, 95, 2.5], '2330': [50, 90, 2.5],
  '1323': [45, 82.5, 2.5], '0293': [22, 40, 1], '0031': [25, 45, 2.5],
  '0043': [70, 130, 2.5], '0085': [70, 125, 2.5], '0739': [140, 260, 5],
  '0585': [40, 75, 2.5], '0586': [35, 70, 2.5], '0605': [60, 120, 5],
  '0289': [22, 40, 1], '0314': [18, 34, 1], '2137': [14, 28, 1],
  '0313': [12, 24, 1], '1409': [80, 170, 5], '0054': [35, 70, 2.5],
  '0431': [14, 30, 1], '0472': [0, 0, 1], '0687': [0, 0, 1],
}

// Synthetic anthropometry for a 178 cm man going from BMI 34.7 to 22.4 while
// resistance training. These are a plausible illustrative trajectory, not a
// clinical prediction for a real person. Central girths change earlier and more;
// trained limbs change more slowly as lean tissue is partially preserved.
// Model basis: Heymsfield et al. (PMID 18834550), CDC/NHANES protocol and adult
// reference data. Values are relaxed circumferences taken at consistent landmarks.
const MEASUREMENTS = {
  neck: [43.5, 38.5], shoulders: [127, 118], chest: [119, 101.5],
  'left-arm': [38.7, 34.3], 'right-arm': [39.4, 35],
  'left-forearm': [31.7, 29.3], 'right-forearm': [32.2, 29.8],
  waist: [116, 81], abdomen: [122, 84], hips: [112, 94],
  'left-thigh': [66.5, 55.5], 'right-thigh': [67.3, 56.3],
  'left-calf': [42.5, 38], 'right-calf': [43, 38.5],
}

const MEASUREMENT_EXPONENT = {
  neck: .94, shoulders: .98, chest: .92,
  'left-arm': 1.04, 'right-arm': 1.04,
  'left-forearm': 1.08, 'right-forearm': 1.08,
  waist: .82, abdomen: .8, hips: .92,
  'left-thigh': 1.02, 'right-thigh': 1.02,
  'left-calf': 1.08, 'right-calf': 1.08,
}

const MEASUREMENT_PHASE = Object.fromEntries(Object.keys(MEASUREMENTS).map((id, index) => [id, index * .71 + .3]))
const MEASUREMENT_NOISE = {
  neck: .2, shoulders: .45, chest: .45, 'left-arm': .25, 'right-arm': .25,
  'left-forearm': .18, 'right-forearm': .18, waist: .65, abdomen: .75, hips: .48,
  'left-thigh': .4, 'right-thigh': .4, 'left-calf': .22, 'right-calf': .22,
}

function buildWeights(sourceWeights) {
  const sorted = [...sourceWeights].sort((a, b) => String(a.d).localeCompare(String(b.d)) || Number(a.t || 0) - Number(b.t || 0))
  return sorted.map((entry, index) => {
    const progress = sorted.length === 1 ? 1 : index / (sorted.length - 1)
    const lossCurve = Math.pow(progress, .82)
    const plateau = .85 * Math.exp(-Math.pow((progress - .43) / .055, 2))
      + .55 * Math.exp(-Math.pow((progress - .72) / .045, 2))
    const fluctuation = Math.sin(Math.PI * progress)
      * (.42 * Math.sin(index * 1.73) + .22 * Math.cos(index * .51))
    let weight = 110 - 39 * lossCurve + plateau + fluctuation
    if (index === 0) weight = 110
    if (index === sorted.length - 1) weight = 71
    return { ...entry, w: round1(weight) }
  })
}

function bodyWeightAt(bodyweight, iso) {
  return bodyweight.reduce((latest, entry) => entry.d <= iso ? entry : latest, null)?.w || 110
}

function trainingLoad(exerciseId, weekIndex, factor = 1) {
  const [start, finish, step] = LOADS[exerciseId] || [20, 40, 2.5]
  if (!start) return 0
  const progress = clamp(0, weekIndex / 51, 1)
  const blockWeek = weekIndex % 8
  const deload = blockWeek === 7
  const wave = deload ? .84 : 1 + blockWeek * .008
  const load = (start + (finish - start) * Math.pow(progress, .78)) * wave * factor
  return roundLoad(load, step)
}

function buildWorkouts(startIso, endIso, bodyweight) {
  const byWeekday = new Map(ROUTINES.map(routine => [routine.weekday, routine]))
  const workouts = []
  const exWeights = {}
  const best = {}
  const seen = new Set()
  const startDay = dayNumber(startIso)
  const endDay = dayNumber(endIso)

  for (let ordinal = startDay; ordinal <= endDay; ordinal++) {
    const iso = dateFromDay(ordinal)
    const routine = byWeekday.get(weekday(iso))
    if (!routine) continue
    const weekIndex = Math.floor((ordinal - startDay) / 7)
    const blockWeek = weekIndex % 8
    const deload = blockWeek === 7
    const prs = []
    const entries = routine.ex.map(([id, configuredSets, configuredReps, factor = 1], exerciseIndex) => {
      const weight = trainingLoad(id, weekIndex, factor)
      const setsCount = deload ? Math.max(2, configuredSets - 1) : configuredSets
      const progress = clamp(0, weekIndex / 51, 1)
      const bodyweightReps = !weight ? Math.round(configuredReps + progress * (id === '0652' ? 5 : 4)) : configuredReps
      const sets = Array.from({ length: setsCount }, (_, setIndex) => {
        const deterministicDrop = !deload && setIndex === setsCount - 1 && (weekIndex + exerciseIndex) % 5 === 0 ? 1 : 0
        const rirBase = deload ? 4 : clamp(.5, 3.1 - blockWeek * .34, 3.1)
        const rir = Math.round(clamp(.5, rirBase + (setsCount - 1 - setIndex) * .35 - exerciseIndex * .05, 5) * 2) / 2
        return { w: weight, r: Math.max(5, bodyweightReps - deterministicDrop), done: true, rir }
      })
      if (weight > (best[id] || 0)) {
        if (seen.has(id)) prs.push(id)
        best[id] = weight
        exWeights[id] = { w: weight, d: iso }
      }
      seen.add(id)
      return { id, sets, topW: weight || null }
    })
    const totalSets = entries.reduce((sum, entry) => sum + entry.sets.length, 0)
    const saturday = weekday(iso) === 6
    const startMs = at(iso, saturday ? 10 : 18, 8 + ((weekIndex * 7 + routine.weekday * 3) % 18))
    const duration = 56 + Math.round(totalSets * .92) + ((weekIndex + routine.weekday) % 9)
    const workout = {
      id: `year-workout-${String(workouts.length + 1).padStart(3, '0')}`,
      d: iso,
      start: startMs,
      end: startMs + duration * 60000,
      routineId: routine.id,
      name: routine.name,
      bw: bodyWeightAt(bodyweight, iso),
      entries,
      prs,
    }
    workout.vol = entries.reduce((volume, entry) => volume + entry.sets.reduce((sum, set) => sum + set.w * set.r, 0), 0)
    workouts.push(workout)
  }
  return { workouts, exWeights }
}

function buildMeasurements(bodyweight, workouts) {
  const thursdays = bodyweight.filter(entry => weekday(entry.d) === 4)
  return thursdays.map((entry, index) => {
    const timeProgress = thursdays.length === 1 ? 1 : index / (thursdays.length - 1)
    const weightProgress = clamp(0, (110 - entry.w) / 39, 1)
    const workoutProgress = workouts.filter(workout => workout.d <= entry.d).length / workouts.length
    const progress = clamp(0, weightProgress * .78 + timeProgress * .12 + workoutProgress * .1, 1)
    const taper = Math.sin(Math.PI * timeProgress)
    const values = Object.fromEntries(Object.entries(MEASUREMENTS).map(([partId, [start, finish]]) => {
      const phase = MEASUREMENT_PHASE[partId]
      const noise = taper * MEASUREMENT_NOISE[partId] * (Math.sin(index * 1.21 + phase) + Math.cos(index * .43 + phase) * .45)
      const regionProgress = Math.pow(progress, MEASUREMENT_EXPONENT[partId] || 1)
      let value = start + (finish - start) * regionProgress + noise
      if (index === 0) value = start
      if (index === thursdays.length - 1) value = finish
      return [partId, round1(value)]
    }))
    const timestamp = Number(entry.t || at(entry.d, 7, 30)) + 15 * 60000
    return {
      id: `body-${weekKey(entry.d)}`,
      week: weekKey(entry.d),
      date: entry.d,
      values,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
}

function validate(state) {
  const errors = []
  const expectedParts = Object.keys(MEASUREMENTS)
  if (state.bodyweight.length !== 105) errors.push(`esperava 105 pesagens; recebeu ${state.bodyweight.length}`)
  if (state.bodyweight[0]?.w !== 110 || state.bodyweight.at(-1)?.w !== 71) errors.push('peso precisa começar em 110 kg e terminar em 71 kg')
  if (state.bodyMeasurements.length !== 53) errors.push(`esperava 53 check-ins; recebeu ${state.bodyMeasurements.length}`)
  if (new Set(state.bodyMeasurements.map(item => item.week)).size !== 53) errors.push('as semanas de medição precisam ser únicas')
  if (state.bodyMeasurements.some(item => expectedParts.some(partId => !(item.values[partId] > 0)))) errors.push('todo check-in precisa conter as 14 circunferências')
  expectedParts.forEach(partId => {
    const values = state.bodyMeasurements.map(item => item.values[partId])
    const [expectedStart, expectedFinish] = MEASUREMENTS[partId]
    const changedWeeks = values.slice(1).filter((value, index) => value !== values[index]).length
    if (values[0] !== expectedStart || values.at(-1) !== expectedFinish) errors.push(`${partId} não respeita os pontos antropométricos inicial/final`)
    if (new Set(values).size < 20 || changedWeeks < 28) errors.push(`${partId} não apresenta evolução suficiente ao longo do ano`)
  })
  ;[['left-arm', 'right-arm'], ['left-forearm', 'right-forearm'], ['left-thigh', 'right-thigh'], ['left-calf', 'right-calf']].forEach(([left, right]) => {
    if (state.bodyMeasurements.some(item => item.values[right] <= item.values[left])) errors.push(`a assimetria entre ${left}/${right} foi invertida`)
  })
  if (state.bodyMeasurements.some(item => Object.hasOwn(item, 'weight'))) errors.push('check-ins não devem duplicar o peso corporal')
  if (state.workouts.length !== 260) errors.push(`esperava 260 treinos; recebeu ${state.workouts.length}`)
  if (state.workouts.some(workout => workout.entries.length < 6)) errors.push('todo treino precisa ter pelo menos seis exercícios')
  const startDay = dayNumber(state.bodyweight[0].d)
  for (let week = 0; week < 52; week++) {
    const from = startDay + week * 7
    const to = from + 6
    const count = state.workouts.filter(workout => {
      const day = dayNumber(workout.d)
      return day >= from && day <= to
    }).length
    if (count !== 5) errors.push(`a semana de evolução ${week + 1} contém ${count} treinos em vez de cinco`)
  }
  if (!state.profile?.name || !state.profile?.birthDate || !state.profile?.heightCm || !state.profile?.goal || !state.profile?.experience) errors.push('o perfil precisa estar completo para pular o onboarding')
  if (errors.length) throw new Error(`Perfil anual inválido:\n- ${errors.join('\n- ')}`)
}

function generate(source) {
  if (!Array.isArray(source.bodyweight) || source.bodyweight.length < 2) throw new Error('O JSON de origem precisa conter o histórico de peso que define as datas do ano.')
  const bodyweight = buildWeights(source.bodyweight)
  const firstDate = bodyweight[0].d
  const lastDate = bodyweight.at(-1).d
  const { workouts, exWeights } = buildWorkouts(firstDate, lastDate, bodyweight)
  const bodyMeasurements = buildMeasurements(bodyweight, workouts)
  const routines = ROUTINES.map(routine => ({
    id: routine.id,
    name: routine.name,
    emoji: routine.emoji,
    ex: routine.ex.map(([id, sets, reps]) => ({ id, sets, reps, weight: 0 })),
  }))
  const result = {
    ...source,
    body: 'male',
    targetW: 71,
    planMode: 'weekly',
    profile: {
      name: 'Rafael Martins',
      avatarId: 'avatar-27',
      birthDate: '1991-04-18',
      sex: 'male',
      heightCm: 178,
      startWeight: 110,
      goal: 'lose_weight',
      experience: 'intermediate',
      completedAt: at(firstDate, 7, 0),
    },
    routines,
    week: Object.fromEntries(ROUTINES.map(routine => [routine.weekday, routine.id])),
    dayPlan: {},
    workouts,
    bodyweight,
    bodyMeasurements,
    bodyMeasurementGoals: {
      neck: 38.5, shoulders: 118, chest: 101.5,
      'left-arm': 34.3, 'right-arm': 35,
      'left-forearm': 29.3, 'right-forearm': 29.8,
      waist: 81, abdomen: 84, hips: 94,
      'left-thigh': 55.5, 'right-thigh': 56.3,
      'left-calf': 38, 'right-calf': 38.5,
    },
    exWeights,
    effort: 'rir',
    onboardingDone: true,
    _ts: bodyMeasurements.at(-1).updatedAt,
  }
  validate(result)
  return result
}

const [inputArg, outputArg] = process.argv.slice(2)
if (!inputArg) throw new Error('Uso: node scripts/generate-year-profile.mjs <origem.json> [destino.json]')
const input = path.resolve(inputArg)
const output = path.resolve(outputArg || inputArg)
const source = JSON.parse(fs.readFileSync(input, 'utf8'))
const result = generate(source)
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({
  output,
  from: result.bodyweight[0],
  to: result.bodyweight.at(-1),
  weighIns: result.bodyweight.length,
  measurementCheckins: result.bodyMeasurements.length,
  measurements: result.bodyMeasurements.length * Object.keys(MEASUREMENTS).length,
  workouts: result.workouts.length,
  exercisesLogged: result.workouts.reduce((sum, workout) => sum + workout.entries.length, 0),
  setsLogged: result.workouts.reduce((sum, workout) => sum + workout.entries.reduce((n, entry) => n + entry.sets.length, 0), 0),
}, null, 2))
