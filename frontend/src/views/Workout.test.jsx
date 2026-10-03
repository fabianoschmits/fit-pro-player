import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHTML } from 'linkedom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { todayISO } from '../lib/format.js'

const mocks = vi.hoisted(() => {
  const state = {
    S: null,
    startRest: vi.fn(),
    startWork: vi.fn(),
    finishWorkEarly: vi.fn(),
    stopRest: vi.fn(),
    topWeightSheet: vi.fn(),
    workoutCompleteSheet: vi.fn(),
    navigate: vi.fn(),
  }
  state.storeSnapshot = () => ({
    S: state.S,
    user: null,
    update: mut => mut(state.S),
  })
  state.uiSnapshot = () => ({
    work: state.work,
    timer: state.timer,
    startRest: state.startRest,
    stopRest: state.stopRest,
    startWork: state.startWork,
    finishWorkEarly: state.finishWorkEarly,
    toast: vi.fn(),
  })
  return state
})

vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector(mocks.storeSnapshot())
  useStore.getState = mocks.storeSnapshot
  return { useStore }
})
vi.mock('../store/useUI.js', () => {
  const useUI = selector => selector ? selector(mocks.uiSnapshot()) : mocks.uiSnapshot()
  useUI.getState = mocks.uiSnapshot
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('../sheets.jsx', () => ({
  startFlow: vi.fn(),
  exercisePicker: vi.fn(),
  exConfigSheet: vi.fn(),
  exerciseDetailSheet: vi.fn(),
  topWeightSheet: mocks.topWeightSheet,
  finishWorkout: vi.fn(),
  workoutCompleteSheet: mocks.workoutCompleteSheet,
  confirmSheet: vi.fn(),
}))
vi.mock('../components/Media.jsx', () => ({ default: () => null }))
let dom
let root
let container

function exercise(id, sets, extra = {}) {
  return {
    id,
    target: { mode: 'reps', reps: 5, weight: 60, bodyweight: false },
    sets: sets.map(done => ({ w: 60, r: 5, done })),
    ...extra,
  }
}

function workout(entries, cur = 0) {
  return {
    unit: 'kg', restSec: 90, sound: false, effort: 'none', mediaSize: 'full',
    workouts: [], exWeights: {}, routines: [], week: {}, dayPlan: {},
    active: { id: 'active', name: 'Test workout', start: Date.now(), cur, entries },
  }
}

function installDom() {
  const parsed = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
  dom = parsed.window
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'Node', 'Element', 'Event', 'Blob']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.getElementById('root')
  root = createRoot(container)
}

async function mount(entries, cur = 0) {
  mocks.S = workout(entries, cur)
  installDom()
  await act(async () => { root.render(React.createElement(Workout)) })
}

async function mountState(state) {
  mocks.S = state
  installDom()
  await act(async () => { root.render(React.createElement(Workout)) })
}

async function unmount() {
  if (!root) return
  await act(async () => { root.unmount() })
  root = null
  container = null
  dom = null
}

async function toggleSet(index) {
  const checkbox = container.querySelectorAll('[role="checkbox"]')[index]
  expect(checkbox).toBeTruthy()
  await act(async () => { checkbox.dispatchEvent(new dom.Event('click', { bubbles: true })) })
}

function startWorkoutButton() {
  return [...container.querySelectorAll('button')].find(button => button.textContent.includes('Começar treino'))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.timer = null
  mocks.work = null
})

afterEach(async () => {
  await unmount()
})

describe('Workout set completion flow', () => {
  it('puts execution guidance on the current completion field and switches it off during rest', async () => {
    await mount([exercise('plain-bench', [false, false])])
    const row = container.querySelector('.setrow.is-current')
    expect(row.querySelector('[role="checkbox"] svg')).toBeTruthy()
    const hint = container.querySelector('.set-execution-hint')
    expect(hint).toBeTruthy()
    expect(hint.textContent).toContain('Executando série')
    expect(row.querySelector('[role="checkbox"]').getAttribute('aria-describedby')).toBe(hint.id)
    expect(row.querySelector('[role="checkbox"]').classList.contains('is-executing')).toBe(true)
    expect(container.querySelectorAll('.chk.is-executing')).toHaveLength(1)
    await toggleSet(0)
    expect(mocks.S.active.entries[0].sets.map(set => set.done)).toEqual([true, false])
    expect(mocks.startRest).toHaveBeenCalledWith(90)
    mocks.timer = { left: 90, total: 90 }
    await act(async () => root.render(<Workout />))
    expect(container.querySelectorAll('.chk.is-executing')).toHaveLength(0)
    expect(container.querySelector('.setrow.is-current .chk').disabled).toBe(true)
    expect(container.querySelector('.set-execution-hint').textContent).toContain('Descansando')
    mocks.timer = null
    await act(async () => root.render(<Workout />))
    expect(container.querySelectorAll('.chk.is-executing')).toHaveLength(1)
  })

  it('guides execution, completes only the next set, and switches to rest guidance', async () => {
    await mount([exercise('plain-bench', [false, false])])
    expect(container.textContent).toContain('Execute a série 1 de 2')
    const action = [...container.querySelectorAll('button')].find(b => b.textContent === 'Concluir série e descansar')
    expect(action).toBeTruthy()
    await act(async () => action.click())
    expect(mocks.S.active.entries[0].sets.map(s => s.done)).toEqual([true, false])
    expect(mocks.startRest).toHaveBeenCalledWith(90)
    mocks.timer = { left: 75, total: 90 }
    await act(async () => root.render(<Workout />))
    expect(container.textContent).toContain('Descansando')
    expect(container.textContent).not.toContain('Execute a série')
    expect(container.querySelector('.exercise-phase button')).toBeNull()
    mocks.timer = null
    await act(async () => root.render(<Workout />))
    expect(container.textContent).toContain('Execute a série 2 de 2')
    expect(container.querySelector('.exercise-phase button').textContent).toBe('Concluir treino')
  })

  it('guides a superset to the next member without starting rest', async () => {
    await mount([exercise('plain-bench', [false, false], { sg: 'pair' }), exercise('plain-squat', [false, false], { sg: 'pair' })])
    const action = [...container.querySelectorAll('button')].find(b => b.textContent === 'Concluir série e ir ao próximo exercício')
    expect(action).toBeTruthy()
    await act(async () => action.click())
    expect(mocks.S.active.cur).toBe(1)
    expect(mocks.startRest).not.toHaveBeenCalled()
  })

  it('offers completion on the last set without starting a rest timer', async () => {
    await mount([exercise('plain-bench', [true, false], { asked: true })])
    await act(async () => container.querySelector('.exercise-phase button').click())
    expect(mocks.S.active.entries[0].sets.every(set => set.done)).toBe(true)
    expect(mocks.workoutCompleteSheet).toHaveBeenCalledTimes(1)
    expect(mocks.startRest).not.toHaveBeenCalled()
  })

  it('starts the timed set without immediately recording completion', async () => {
    await mount([exercise('plank', [false, false], { target: { mode: 'time' }, sets: [{ sec: 45, done: false }, { sec: 45, done: false }] })])
    expect(container.querySelector('.exercise-phase button').textContent).toBe('Iniciar série')
    await act(async () => container.querySelector('.exercise-phase button').click())
    expect(mocks.startWork).toHaveBeenCalledWith(45, expect.any(String), expect.any(Function), expect.objectContaining({ entryIdx: 0, setIdx: 0 }))
    expect(mocks.S.active.entries[0].sets[0].done).toBe(false)
    expect(mocks.startRest).not.toHaveBeenCalled()
  })

  it('shows execution only while a timed set is running and completes through its elapsed-time callback', async () => {
    await mount([exercise('plank', [false, false], { target: { mode: 'time' }, sets: [{ sec: 45, done: false }, { sec: 45, done: false }] })])
    expect(container.querySelector('.chk.is-executing')).toBeNull()
    mocks.work = { phase: 'work', entryIdx: 0, setIdx: 0, left: 30, total: 45 }
    await act(async () => root.render(<Workout />))
    expect(container.querySelector('.set-execution-hint').textContent).toContain('Executando série')
    await act(async () => container.querySelector('.chk.is-executing').click())
    expect(mocks.finishWorkEarly).toHaveBeenCalledTimes(1)
    expect(mocks.S.active.entries[0].sets[0].done).toBe(false)
  })

  it('highlights the timed row actually running even when an earlier row is still pending', async () => {
    await mount([exercise('plank', [false, false], { target: { mode: 'time' }, sets: [{ sec: 45, done: false }, { sec: 45, done: false }] })])
    mocks.work = { phase: 'work', entryIdx: 0, setIdx: 1, left: 30, total: 45 }
    await act(async () => root.render(<Workout />))
    expect(container.querySelectorAll('.chk.is-executing')).toHaveLength(1)
    expect(container.querySelector('.chk.is-executing').getAttribute('aria-describedby')).toBe('set-execution-0-1')
    expect(container.querySelector('.chk.is-executing').closest('.setrow').getAttribute('aria-current')).toBe('step')
    expect(container.querySelectorAll('.set-execution-hint')).toHaveLength(1)
  })

  it('applies progression to an assigned session only after an explicit action, keeping the prescription', async () => {
    await mount([exercise('plain-bench', [false, false], { target: { id: 'plain-bench', sets: 2, mode: 'reps', reps: 5, weight: 40 } })])
    mocks.S.active.assignmentId = 'assigned'
    mocks.S.workouts = [{ entries: [{ id: 'plain-bench', target: { sets: 2, reps: 5, weight: 40 }, sets: [{ w: 40, r: 5, done: true }, { w: 40, r: 5, done: true }] }] }]
    await act(async () => root.render(<Workout />))
    await act(async () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Aplicar progressão sugerida').click())
    expect(mocks.S.active.entries[0].sets[0].w).toBeGreaterThan(40)
    expect(mocks.S.active.entries[0].target.weight).toBe(40)
  })
  it('keeps the workout completion action in a dedicated mobile action region', async () => {
    await mount([exercise('plain-bench', [false, false])])

    expect(container.querySelector('.workout-primary-action')).toBeTruthy()
    expect(container.querySelector('.workout-primary-action button')?.textContent).toContain('Terminar')
  })

  it('shows only freestyle and today-plan actions on rest days', async () => {
    await mountState({
      unit: 'kg', restSec: 90, sound: false, effort: 'none', mediaSize: 'full',
      workouts: [], exWeights: {}, week: {}, dayPlan: {}, active: null,
      routines: [
        { id: 'push', name: 'Push', emoji: 'dumbbell', ex: [{ id: 'plain-bench', sets: 3, reps: 8, weight: 60 }] },
        { id: 'pull', name: 'Pull', emoji: 'pullup', ex: [{ id: 'row', sets: 3, reps: 8, weight: 50 }] },
      ],
    })

    expect(container.textContent).toContain('Treino livre')
    expect(container.textContent).toContain('Criar um plano para hoje')
    expect(container.textContent).not.toContain('Outros treinos')

    const create = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Criar um plano para hoje'))
    expect(create).toBeTruthy()
    await act(async () => { create.dispatchEvent(new dom.Event('click', { bubbles: true })) })

    const created = mocks.S.routines.find(r => r.name === 'Plano de hoje')
    expect(created).toBeTruthy()
    expect(mocks.S.dayPlan[todayISO()]).toBe(created.id)
    expect(mocks.navigate).toHaveBeenCalledWith('/plan/r/' + created.id)
  })

  it('lets an empty freestyle workout add its first exercise before the timer starts', async () => {
    await mount([])
    mocks.S.active.start = null
    mocks.S.active.routineId = null
    await act(async () => { root.render(React.createElement(Workout)) })

    const add = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Adicionar exercício'))
    expect(add).toBeTruthy()
    expect(add.disabled).toBe(false)
  })

  it('keeps the first exercise card locked and the clock paused until the workout starts', async () => {
    await mount([exercise('plain-bench', [false, false])])
    mocks.S.active.start = null
    await act(async () => { root.render(React.createElement(Workout)) })

    expect(container.textContent).toContain('0:00')
    expect(startWorkoutButton()).toBeTruthy()
    expect(container.querySelector('.exercise-phase')).toBeNull()
    expect(container.querySelector('[role="checkbox"]')?.disabled).toBe(true)

    await act(async () => { startWorkoutButton().dispatchEvent(new dom.Event('click', { bubbles: true })) })

    expect(mocks.S.active.start).toEqual(expect.any(Number))
    await act(async () => { root.render(React.createElement(Workout)) })
    expect(container.querySelector('[role="checkbox"]')?.disabled).toBe(false)
  })

  it('locks an entire opening superset behind one start action', async () => {
    await mount([
      exercise('superset-a', [false, false], { sg: 'opening-pair' }),
      exercise('superset-b', [false, false], { sg: 'opening-pair' }),
    ])
    mocks.S.active.start = null
    await act(async () => { root.render(React.createElement(Workout)) })

    const starts = [...container.querySelectorAll('button')].filter(button => button.textContent.includes('Começar treino'))
    expect(starts).toHaveLength(1)
    expect([...container.querySelectorAll('[role="checkbox"]')].every(checkbox => checkbox.disabled)).toBe(true)
  })

  it('starts rest between sets but finishes immediately after the final set of the workout', async () => {
    await mount([exercise('plain-bench', [false, false, false])])
    await toggleSet(0)

    expect(mocks.startRest).toHaveBeenCalledOnce()
    expect(mocks.startRest).toHaveBeenCalledWith(90)

    await unmount()
    vi.clearAllMocks()
  mocks.timer = null
    await mount([exercise('plain-treadmill', [false], {
      target: { mode: 'cardio', min: 20, speed: 8 },
    })])
    await toggleSet(0)

    expect(mocks.startRest).not.toHaveBeenCalled()
    expect(mocks.workoutCompleteSheet).toHaveBeenCalledOnce()
  })

  it('uses the assigned exercise rest instead of the global timer default', async () => {
    await mount([exercise('0025', [false, false], { target: { mode: 'reps', reps: 8, weight: 40, rest: 25 } })])
    await act(async () => container.querySelector('[role="checkbox"]').click())
    expect(mocks.startRest).toHaveBeenCalledWith(25)
  })

  it('leaves a completed superset selected while its top-weight sheet owns the advance choice', async () => {
    const group = 'superset-1'
    await mount([
      exercise('superset-a', [true, true, true], { sg: group, asked: true }),
      exercise('superset-b', [true, true, false], { sg: group }),
      exercise('next-exercise', [false, false, false]),
    ], 1)
    // The completed first member auto-collapses, so the partner's final visible row is index 2.
    await toggleSet(2)

    expect(mocks.S.active.cur).toBe(1)
    expect(mocks.startRest).toHaveBeenCalledWith(90, expect.any(Function))
  })

  it('advances a completed ordinary exercise after rest so the next one uses the same flow', async () => {
    await mount([
      exercise('timed-hold', [false], {
        target: { mode: 'time', sec: 30, bodyweight: true },
        sets: [{ sec: 30, done: false }],
      }),
      exercise('next-hold', [false], {
        target: { mode: 'time', sec: 30, bodyweight: true },
        sets: [{ sec: 30, done: false }],
      }),
    ])

    await toggleSet(0)

    expect(mocks.startRest).toHaveBeenCalledWith(90, expect.any(Function))
    const afterRest = mocks.startRest.mock.calls[0][1]
    await act(async () => { afterRest() })

    expect(mocks.S.active.cur).toBe(1)
  })
})

describe('superset flow survives an exercise being removed mid-session', () => {
  // removeActiveExercise splices A.entries, shifting every index above the removal down.
  // The high-water marks are index-keyed, so without re-baselining the shifted exercise
  // inherits its predecessor's mark and its next completed set reads as an uncheck/re-check
  // — no advance, and no rest at the end of the round.
  it('still advances and rests for sets completed after a removal', async () => {
    // warm(2 sets, both done) ahead of a bench/row superset with nothing done yet.
    await mount([
      exercise('warm', [true, true]),
      exercise('bench', [false, false], { sg: 'g1' }),
      exercise('row', [false, false], { sg: 'g1' }),
    ], 1)

    // Drop the first exercise: bench moves 1 -> 0, row moves 2 -> 1.
    // Stale marks would be [2, 0, 0] against entries that are now [bench, row].
    await act(async () => {
      mocks.S.active.entries.splice(0, 1)
      mocks.S.active.cur = 0
      root.render(React.createElement(Workout))
    })
    mocks.startRest.mockClear()

    // First member of the group: real progress, so the flow advances to the partner.
    await toggleSet(0)
    await act(async () => { root.render(React.createElement(Workout)) })
    expect(mocks.S.active.cur).toBe(1)

    // Partner closes the round (each still has a second set), which is what starts the rest.
    await toggleSet(2)
    expect(mocks.startRest).toHaveBeenCalledWith(90)
  })
})
