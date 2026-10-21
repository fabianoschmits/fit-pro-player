export const DEMO_EXERCISES = [
  { id: 'pullup', guideId: '0652', name: 'Barra fixa', muscle: 'Costas e bíceps', sets: 3, reps: 10, load: null, rest: 15, unit: 'reps', mode: 'reps' },
  { id: 'row', guideId: '0861', name: 'Remada baixa', muscle: 'Costas e postura', sets: 2, reps: 12, load: 25, rest: 20, unit: 'reps', mode: 'reps' },
  { id: 'hold', guideId: '3419', name: 'Sustentação em L', muscle: 'Abdômen e estabilidade', sets: 1, reps: 20, load: null, rest: 15, unit: 's', mode: 'time' },
]

export const formatDemoTime = seconds => `${Math.floor(Math.max(0, seconds) / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, '0')}`
const countFor = (state, exercise) => state.results.filter(result => result.exerciseId === exercise.id).length
const valuesFor = exercise => ({ reps: exercise.reps, load: exercise.load, rir: 2 })

export function createDemoSession() {
  return { phase: 'ready', exerciseIndex: 0, ...valuesFor(DEMO_EXERCISES[0]), results: [], now: 0, startedAt: null, activeAt: null, deadline: null, finishedAt: null, notice: 'Ajuste sua meta e comece quando estiver pronto.' }
}

function selectExercise(state, index) {
  const exercise = DEMO_EXERCISES[index]
  return { ...state, exerciseIndex: index, ...valuesFor(exercise), phase: countFor(state, exercise) >= exercise.sets ? 'exerciseDone' : 'ready', deadline: null, activeAt: null, notice: 'Prepare o equipamento e confira sua meta.' }
}

function finishSet(state, now, endedAt = now) {
  const exercise = DEMO_EXERCISES[state.exerciseIndex]
  const completed = countFor(state, exercise)
  if (completed >= exercise.sets) return state
  const durationSeconds = Math.max(0, Math.floor((endedAt - state.activeAt) / 1000))
  const result = { exerciseId: exercise.id, name: exercise.name, setNumber: completed + 1, reps: exercise.mode === 'time' ? durationSeconds : state.reps, load: state.load, rir: state.rir, unit: exercise.unit, durationSeconds }
  const last = completed + 1 >= exercise.sets
  return { ...state, now, results: [...state.results, result], phase: last ? 'exerciseDone' : 'rest', activeAt: null, deadline: last ? null : now + exercise.rest * 1000, restTotal: exercise.rest, notice: last ? 'Todas as séries deste exercício foram registradas.' : 'Série registrada. Respire e recupere.' }
}

function scenario(state, phase, now) {
  if (!['ready', 'countdown', 'active', 'rest', 'exerciseDone', 'complete'].includes(phase)) return state
  let next = selectExercise(createDemoSession(), state.exerciseIndex)
  next = { ...next, now, startedAt: phase === 'ready' ? null : now }
  const addResults = (exercise, count) => {
    for (let i = 0; i < count; i++) next.results.push({ exerciseId: exercise.id, name: exercise.name, setNumber: i + 1, reps: exercise.reps, load: exercise.load, rir: 2, unit: exercise.unit, durationSeconds: 12 })
  }
  if (phase === 'complete') {
    DEMO_EXERCISES.forEach(exercise => addResults(exercise, exercise.sets))
    const sessionSeconds = DEMO_EXERCISES.reduce((sum, item) => sum + item.sets * 15 + (item.sets - 1) * item.rest, 0)
    return { ...next, phase, startedAt: now - sessionSeconds * 1000, finishedAt: now, notice: 'Este é o resumo da sua sessão de demonstração.' }
  }
  const exercise = DEMO_EXERCISES[next.exerciseIndex]
  if (phase === 'exerciseDone') addResults(exercise, exercise.sets)
  if (phase === 'rest') addResults(exercise, 1)
  const previewSeconds = phase === 'exerciseDone' ? exercise.sets * 15 + (exercise.sets - 1) * exercise.rest : phase === 'rest' ? 15 : phase === 'active' ? 3 : 0
  const notices = { ready: next.notice, countdown: 'Prepare-se. O exercício começa em três segundos.', active: 'Execute agora. Mantenha o controle do movimento.', rest: 'Série registrada. Respire e recupere.', exerciseDone: 'Todas as séries deste exercício foram registradas.' }
  return { ...next, phase, startedAt: phase === 'ready' ? null : now - previewSeconds * 1000, activeAt: phase === 'active' ? now : null, deadline: phase === 'countdown' ? now + 3000 : phase === 'rest' ? now + exercise.rest * 1000 : null, notice: notices[phase] }
}

export function demoReducer(state, action) {
  const now = Number.isFinite(action.now) ? action.now : state.now
  const exercise = DEMO_EXERCISES[state.exerciseIndex]
  switch (action.type) {
    case 'RESET': return createDemoSession()
    case 'SET_PHASE': return scenario(state, action.phase, now)
    case 'CHOOSE_EXERCISE':
      if (!Number.isInteger(action.index) || !DEMO_EXERCISES[action.index] || ['countdown', 'active', 'rest', 'complete'].includes(state.phase)) return state
      return selectExercise({ ...state, now }, action.index)
    case 'ADJUST': {
      if (action.field === 'rest' && state.phase === 'rest' && Number.isFinite(action.delta)) {
        const remaining = Math.min(300, Math.max(0, Math.ceil((state.deadline - now) / 1000) + action.delta))
        return { ...state, now, deadline: remaining ? now + remaining * 1000 : null, restTotal: Math.max(remaining, Math.min(300, (state.restTotal ?? exercise.rest) + action.delta)), phase: remaining ? 'rest' : countFor(state, exercise) >= exercise.sets ? 'exerciseDone' : 'ready', notice: remaining ? state.notice : 'Descanso concluído. Prepare-se para a próxima série.' }
      }
      if (!['ready', 'active'].includes(state.phase) || !['reps', 'load', 'rir'].includes(action.field) || !Number.isFinite(action.delta) || (action.field === 'load' && state.load === null)) return state
      const bounds = action.field === 'reps' ? [1, exercise.mode === 'time' ? 600 : 100] : action.field === 'rir' ? [0, 5] : [0, 500]
      const value = Math.min(bounds[1], Math.max(bounds[0], state[action.field] + action.delta))
      const adjusted = { ...state, now, [action.field]: value }
      if (action.field === 'reps' && state.phase === 'active' && exercise.mode === 'time' && now >= state.activeAt + value * 1000) return finishSet(adjusted, now)
      return adjusted
    }
    case 'TICK': {
      if (state.startedAt === null || state.phase === 'complete') return state
      if (state.phase === 'countdown' && now >= state.deadline) return { ...state, now, phase: 'active', activeAt: state.deadline, deadline: null, notice: 'Execute agora. Mantenha o controle do movimento.' }
      if (state.phase === 'rest' && now >= state.deadline) return { ...state, now, phase: countFor(state, exercise) >= exercise.sets ? 'exerciseDone' : 'ready', deadline: null, notice: 'Descanso concluído. Prepare-se para a próxima série.' }
      if (state.phase === 'active' && exercise.mode === 'time' && now >= state.activeAt + state.reps * 1000) return finishSet(state, now, state.activeAt + state.reps * 1000)
      return { ...state, now }
    }
    case 'PRIMARY':
      if (state.phase === 'ready') return { ...state, phase: 'countdown', now, startedAt: state.startedAt ?? now, deadline: now + 3000, notice: 'Prepare-se. O exercício começa em três segundos.' }
      if (state.phase === 'countdown') return { ...state, phase: 'active', now, activeAt: now, deadline: null, notice: 'Execute agora. Mantenha o controle do movimento.' }
      if (state.phase === 'active') return finishSet(state, now)
      if (state.phase === 'rest') return { ...state, phase: countFor(state, exercise) >= exercise.sets ? 'exerciseDone' : 'ready', now, deadline: null, notice: 'Descanso encerrado. Inicie a próxima série quando estiver pronto.' }
      if (state.phase === 'exerciseDone') {
        const next = DEMO_EXERCISES.findIndex((item, index) => index > state.exerciseIndex && countFor(state, item) < item.sets)
        const pending = next >= 0 ? next : DEMO_EXERCISES.findIndex(item => countFor(state, item) < item.sets)
        return pending >= 0 ? selectExercise({ ...state, now }, pending) : { ...state, phase: 'complete', now, finishedAt: now, notice: 'Treino concluído. Confira suas séries registradas.' }
      }
      return state.phase === 'complete' ? createDemoSession() : state
    default: return state
  }
}

export function getDemoModel(state) {
  const exercise = DEMO_EXERCISES[state.exerciseIndex]
  const completedSets = countFor(state, exercise)
  const total = DEMO_EXERCISES.reduce((sum, item) => sum + item.sets, 0)
  const remaining = Math.max(0, Math.ceil(((state.deadline ?? state.now) - state.now) / 1000))
  const setSeconds = state.activeAt === null ? 0 : Math.max(0, Math.floor((state.now - state.activeAt) / 1000))
  const labels = {
    ready: ['Pronto para começar', 'Iniciar série', 'play', 'Sua próxima série'],
    countdown: ['Prepare-se', 'Executar agora', 'play', 'Prepare-se'],
    active: ['Em execução', 'Concluir série', 'check', 'Execute agora'],
    rest: ['Descanso', 'Pular descanso', 'chevronRight', 'Recupere o fôlego'],
    exerciseDone: ['Exercício concluído', state.results.length === total ? 'Finalizar treino' : 'Próximo exercício', 'chevronRight', 'Exercício concluído'],
    complete: ['Treino concluído', 'Treinar novamente', 'history', 'Treino concluído'],
  }[state.phase]
  let displayValue = state.reps, displayUnit = exercise.unit
  if (state.phase === 'countdown') { displayValue = remaining; displayUnit = 'para começar' }
  if (state.phase === 'rest') { displayValue = formatDemoTime(remaining); displayUnit = 'de descanso' }
  if (state.phase === 'active' && exercise.mode === 'time') displayValue = Math.max(0, state.reps - setSeconds)
  if (state.phase === 'exerciseDone') { displayValue = '✓'; displayUnit = `${completedSets} séries feitas` }
  if (state.phase === 'complete') { displayValue = state.results.length; displayUnit = 'séries registradas' }
  return { ...state, exercise, exerciseCount: DEMO_EXERCISES.length, setIndex: Math.min(completedSets, exercise.sets - 1), totalSets: exercise.sets, completedSets, remaining, restDuration: state.restTotal ?? exercise.rest, progress: state.results.length / total, completedTotal: state.results.length, total, phaseLabel: labels[0], actionLabel: labels[1], actionIcon: labels[2], phaseTitle: labels[3], phaseHint: state.notice, displayValue, displayUnit, elapsedLabel: formatDemoTime(state.startedAt === null ? 0 : ((state.finishedAt ?? state.now) - state.startedAt) / 1000), setElapsedLabel: formatDemoTime(setSeconds) }
}
