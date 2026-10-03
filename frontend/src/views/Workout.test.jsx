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
    startManualSet: vi.fn((sessionId, entryIdx, setIdx) => {
      state.manualSet = { sessionId, entryIdx, setIdx, exerciseId: state.S.active.entries[entryIdx].id }
      return true
    }),
    stopManualSet: vi.fn(() => { state.manualSet = null }),
    stopWork: vi.fn(),
    stopRest: vi.fn(),
    topWeightSheet: vi.fn(),
    workoutCompleteSheet: vi.fn(),
    exercisePicker: vi.fn(),
    exConfigSheet: vi.fn(),
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
    manualSet: state.manualSet,
    startManualSet: state.startManualSet,
    stopManualSet: state.stopManualSet,
    stopWork: state.stopWork,
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
  exercisePicker: mocks.exercisePicker,
  exConfigSheet: mocks.exConfigSheet,
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
  let checkbox = container.querySelectorAll('.set-action')[index]
  expect(checkbox).toBeTruthy()
  if (checkbox.disabled) {
    const play = checkbox.closest('.setrow').parentElement.querySelector('.set-start-action')
    expect(play).toBeTruthy()
    await act(async () => play.click())
    await act(async () => root.render(<Workout />))
    checkbox = container.querySelectorAll('.set-action')[index]
  }
  await act(async () => { checkbox.dispatchEvent(new dom.Event('click', { bubbles: true })) })
}

function startWorkoutButton() {
  return [...container.querySelectorAll('button')].find(button => button.textContent.includes('Começar treino'))
}

function buttonNamed(scope, label) {
  expect(scope).toBeTruthy()
  const button = [...scope.querySelectorAll('button')].find(button => button.textContent.trim() === label)
  expect(button).toBeTruthy()
  return button
}

async function clickAndRender(button) {
  expect(button).toBeTruthy()
  await act(async () => button.click())
  await act(async () => root.render(<Workout />))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.timer = null
  mocks.work = null
  mocks.manualSet = null
})

afterEach(async () => {
  await unmount()
})

describe('Workout set completion flow', () => {
  it('requires a fresh Play after navigating away from an executing set', async () => {
    await mount([exercise('bench', [false]), exercise('row', [false])])
    await act(async () => container.querySelector('.set-start-action').click())
    await act(async () => root.render(<Workout />))
    mocks.S.active.cur = 1
    await act(async () => root.render(<Workout />))
    expect(mocks.manualSet).toBeNull()
    await act(async () => root.render(<Workout />))
    expect(container.querySelector('.chk.is-executing')).toBeNull()
    expect(container.querySelector('.set-start-action')).toBeTruthy()
    expect(mocks.S.active.entries[0].sets[0].done).toBe(false)
  })

  it('still finishes the workout after a completed warm-up is removed', async () => {
    await mount([exercise('bench', [], { asked: true, sets: [
      { w: 20, r: 8, done: true, phase: 'warmup' }, { w: 60, r: 8, done: false },
    ] })])
    await clickAndRender(container.querySelector('.workout-tool-group[data-exidx="0"] .workout-warmup-tools button[data-setidx="0"]'))
    await toggleSet(0)
    expect(mocks.workoutCompleteSheet).toHaveBeenCalledTimes(1)
  })
  it('waits for Play, shows Stop during execution, and waits for another Play after rest', async () => {
    await mount([exercise('plain-bench', [false, false])])
    expect(container.querySelector('.exercise-phase')).toBeNull()
    expect(container.querySelector('.chk.is-executing')).toBeNull()
    expect(container.querySelector('.setrow.is-current .set-action').disabled).toBe(true)
    const play = container.querySelector('.set-start-action')
    expect(play).toBeTruthy()
    expect(play.nextElementSibling.classList.contains('setrow')).toBe(true)
    await act(async () => play.click())
    await act(async () => root.render(<Workout />))
    expect(mocks.startManualSet).toHaveBeenCalledWith(`${mocks.S.active.id}:${mocks.S.active.start}`, 0, 0)
    const stop = container.querySelector('.chk.is-executing')
    expect(stop.getAttribute('aria-label')).toContain('Parar série')
    expect(stop.getAttribute('role')).toBeNull()
    expect(stop.getAttribute('aria-describedby')).toBe(container.querySelector('.set-execution-hint').id)
    expect(container.querySelector('.set-execution-hint').textContent).toContain('Executando série')
    expect(mocks.S.active.entries[0].sets[0].done).toBe(false)
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
    expect(container.querySelectorAll('.chk.is-executing')).toHaveLength(0)
    expect(container.querySelector('.set-start-action')).toBeTruthy()
    expect(mocks.startManualSet).toHaveBeenCalledTimes(1)
  })

  it('guides execution, completes only the next set, and switches to rest guidance', async () => {
    await mount([exercise('plain-bench', [false, false])])
    expect(container.querySelectorAll('.set-execution-hint')).toHaveLength(1)
    await toggleSet(0)
    expect(mocks.S.active.entries[0].sets.map(s => s.done)).toEqual([true, false])
    expect(mocks.startRest).toHaveBeenCalledWith(90)
    mocks.timer = { left: 75, total: 90 }
    await act(async () => root.render(<Workout />))
    expect(container.textContent).toContain('Descansando')
    expect(container.textContent).not.toContain('Execute a série')
    expect(container.querySelector('.exercise-phase button')).toBeNull()
    mocks.timer = null
    await act(async () => root.render(<Workout />))
    expect(container.querySelector('.set-start-action')).toBeTruthy()
    expect(container.querySelector('.chk.is-executing')).toBeNull()
  })

  it('guides a superset to the next member without starting rest', async () => {
    await mount([exercise('plain-bench', [false, false], { sg: 'pair' }), exercise('plain-squat', [false, false], { sg: 'pair' })])
    await toggleSet(0)
    expect(mocks.S.active.cur).toBe(1)
    expect(mocks.startRest).not.toHaveBeenCalled()
    await act(async () => root.render(<Workout />))
    expect(container.querySelectorAll('.set-start-action')).toHaveLength(1)
    expect(container.querySelector('.chk.is-executing')).toBeNull()
  })

  it('offers completion on the last set without starting a rest timer', async () => {
    await mount([exercise('plain-bench', [true, false], { asked: true })])
    await toggleSet(1)
    expect(mocks.S.active.entries[0].sets.every(set => set.done)).toBe(true)
    expect(mocks.workoutCompleteSheet).toHaveBeenCalledTimes(1)
    expect(mocks.startRest).not.toHaveBeenCalled()
  })

  it('starts the timed set without immediately recording completion', async () => {
    await mount([exercise('plank', [false, false], { target: { mode: 'time' }, sets: [{ sec: 45, done: false }, { sec: 45, done: false }] })])
    expect(container.querySelector('.set-start-action').textContent).toContain('Iniciar série')
    await act(async () => container.querySelector('.set-start-action').click())
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
    expect(container.querySelector('.work-set-overlay').previousElementSibling.classList.contains('exercise-input-card')).toBe(true)
    expect(container.querySelector('.work-set-overlay__backdrop')).toBeNull()
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
  it('keeps workout completion below adjustments in an inline session footer', async () => {
    await mount([exercise('plain-bench', [false, false])])

    const tools = container.querySelector('.workout-tools')
    const footer = container.querySelector('.workout-session-footer')
    expect(tools).toBeTruthy()
    expect(footer).toBeTruthy()
    expect(footer.closest('.exercise-input-card')).toBeNull()
    expect(tools.compareDocumentPosition(footer) & 4).toBeTruthy()
    expect(footer.textContent).toContain('Resumo do treino')
    expect(footer.textContent).toContain('0/2')
    expect(footer.textContent).toContain('0/1')
    expect(footer.querySelector('.workout-primary-action button')?.textContent).toBe('Terminar mais cedo')
    expect(container.querySelector('.workout-session-header .finish-hdr-btn')).toBeNull()
  })

  it('keeps auxiliary adjustments outside the series card and collapsed initially', async () => {
    await mount([exercise('plain-bench', [], { sets: [
      { w: 20, r: 8, done: false, phase: 'warmup' }, { w: 60, r: 5, done: false },
    ] })])
    mocks.S.workouts = [{ d: '2026-10-02', entries: [exercise('plain-bench', [true])] }]
    await act(async () => root.render(<Workout />))

    const card = container.querySelector('.exercise-input-card')
    const tools = container.querySelector('details.workout-tools')
    expect(tools).toBeTruthy()
    expect(tools.hasAttribute('open')).toBe(false)
    expect(tools.querySelector('summary').textContent).toContain('Ajustes do treino')
    expect(card.querySelectorAll('button').length).toBeGreaterThan(0)
    expect([...card.querySelectorAll('button')].every(button => button.matches('.set-start-action, .set-action, .stp button'))).toBe(true)
    for (const label of ['Adicionar série de aquecimento', 'Adicionar série', 'Remover série', 'Substituir', 'Usar últimos valores', 'Remover exercício']) {
      expect(card.textContent).not.toContain(label)
      expect(buttonNamed(tools, label).closest('.workout-tools')).toBe(tools)
    }
    expect(container.querySelector('.workout-exercise-heading button[aria-label="Detalhes"]')).toBeTruthy()
    expect(container.querySelector('.workout-exercise-heading').textContent).not.toContain('Substituir')
    expect(buttonNamed(tools, 'Remover exercício').classList.contains('workout-danger-action')).toBe(true)
  })

  it('binds bottom set adjustments and warm-up removal to the chosen superset member', async () => {
    await mount([
      exercise('plain-bench', [false], { sg: 'pair' }),
      exercise('plain-row', [], { sg: 'pair', sets: [
        { w: 20, r: 6, done: false, phase: 'warmup' },
        { w: 30, r: 7, done: false, phase: 'warmup' },
        { w: 60, r: 8, done: false },
      ] }),
    ])
    const firstSets = structuredClone(mocks.S.active.entries[0].sets)
    const groups = container.querySelectorAll('.workout-tool-group')
    expect(groups).toHaveLength(2)
    expect([...groups].map(group => group.getAttribute('data-exidx'))).toEqual(['0', '1'])
    for (const group of groups) expect(group.querySelector('h2, h3, h4, [role="heading"]')?.textContent.trim()).toBeTruthy()
    const partnerTools = () => container.querySelector('.workout-tool-group[data-exidx="1"]')

    await clickAndRender(buttonNamed(partnerTools(), 'Adicionar série de aquecimento'))
    expect(mocks.S.active.entries[1].sets).toHaveLength(4)
    expect(mocks.S.active.entries[1].sets.filter(set => set.phase === 'warmup')).toHaveLength(3)
    await clickAndRender(buttonNamed(partnerTools(), 'Adicionar série'))
    expect(mocks.S.active.entries[1].sets).toHaveLength(5)
    await clickAndRender(buttonNamed(partnerTools(), 'Remover série'))
    expect(mocks.S.active.entries[1].sets).toHaveLength(4)
    const removeWarmup = partnerTools().querySelector('.workout-warmup-tools button[data-setidx="1"]')
    expect(removeWarmup?.textContent).toContain('Remover aquecimento 2')
    const beforeWarmupRemoval = structuredClone(mocks.S.active.entries[1].sets)
    await clickAndRender(removeWarmup)
    expect(mocks.S.active.entries[1].sets).toHaveLength(3)
    expect(mocks.S.active.entries[1].sets).toEqual(beforeWarmupRemoval.filter((_, index) => index !== 1))
    expect(mocks.S.active.entries[0].sets).toEqual(firstSets)
    expect(container.querySelectorAll('.exercise-input-card .setrow button[data-setidx]')).toHaveLength(0)
  })

  it('applies history values and replacement from the correct superset tools', async () => {
    await mount([
      exercise('plain-bench', [false, false], { sg: 'pair' }),
      exercise('plain-row', [false, false], { sg: 'pair' }),
    ])
    mocks.S.workouts = [{ d: '2026-10-02', entries: [exercise('plain-row', [], { sets: [
      { w: 25, r: 8, done: true }, { w: 27, r: 10, done: true },
    ] })] }]
    await act(async () => root.render(<Workout />))
    const partnerTools = () => container.querySelector('.workout-tool-group[data-exidx="1"]')
    await clickAndRender(buttonNamed(partnerTools(), 'Usar últimos valores'))
    expect(mocks.S.active.entries[1].sets.map(set => [set.w, set.r])).toEqual([[25, 8], [27, 10]])
    expect(mocks.S.active.entries[0].sets.map(set => [set.w, set.r])).toEqual([[60, 5], [60, 5]])

    await clickAndRender(buttonNamed(partnerTools(), 'Substituir'))
    await act(async () => mocks.exercisePicker.mock.calls.at(-1)[0]({ id: 'plain-squat' }))
    await act(async () => mocks.exConfigSheet.mock.calls.at(-1)[2]({ mode: 'reps', sets: 2, reps: 7, weight: 30, bodyweight: false }))
    await act(async () => root.render(<Workout />))
    expect(mocks.S.active.entries.map(entry => entry.id)).toEqual(['plain-bench', 'plain-squat'])
    expect(mocks.S.active.entries[1].sets.map(set => [set.w, set.r, set.done])).toEqual([[30, 7, false], [30, 7, false]])
  })

  it('pairs either adjacent exercise and unpairs through bottom adjustments', async () => {
    await mount([exercise('plain-bench', [false]), exercise('plain-row', [false]), exercise('plain-squat', [false])], 1)
    const tools = () => container.querySelector('.workout-tools')
    await clickAndRender(buttonNamed(tools(), 'Fazer superset com o anterior'))
    expect(mocks.S.active.entries[0].sg).toBeTruthy()
    expect(mocks.S.active.entries[1].sg).toBe(mocks.S.active.entries[0].sg)
    expect(mocks.S.active.entries[2].sg).toBeFalsy()
    const unpair = buttonNamed(tools(), 'Desfazer')
    expect(unpair.closest('.workout-tool-group')).toBeNull()
    expect(container.querySelector('.ss-hd').textContent).not.toContain('Desfazer')
    await clickAndRender(unpair)
    expect(mocks.S.active.entries.every(entry => !entry.sg)).toBe(true)
    await clickAndRender(buttonNamed(tools(), 'Fazer superset com o próximo'))
    expect(mocks.S.active.entries[0].sg).toBeFalsy()
    expect(mocks.S.active.entries[1].sg).toBeTruthy()
    expect(mocks.S.active.entries[2].sg).toBe(mocks.S.active.entries[1].sg)
  })

  it('toggles completed rows with the banner outside the series card', async () => {
    await mount([exercise('plain-bench', [true, true], { asked: true })])
    expect(container.querySelector('.exercise-input-card')).toBeNull()
    const banner = () => container.querySelector('.ex-done-banner')
    expect(banner()).toBeTruthy()
    await clickAndRender(banner())
    expect(container.querySelectorAll('.exercise-input-card .setrow')).toHaveLength(2)
    expect(banner()).toBeTruthy()
    expect(banner().closest('.exercise-input-card')).toBeNull()
    expect(container.querySelector('.exercise-input-card').textContent).not.toContain('Collapse')
    expect([...container.querySelectorAll('.exercise-input-card button')].every(button => button.matches('.set-action, .stp button'))).toBe(true)
    await clickAndRender(banner())
    expect(container.querySelector('.exercise-input-card')).toBeNull()
  })

  it('locks bottom adjustments during a manual set while keeping Stop and finish available', async () => {
    await mount([exercise('plain-bench', [false, false]), exercise('plain-row', [false, false])])
    await clickAndRender(container.querySelector('.set-start-action'))
    const toolButtons = container.querySelectorAll('.workout-tools button')
    expect(toolButtons.length).toBeGreaterThan(0)
    expect([...toolButtons].every(button => button.disabled)).toBe(true)
    expect(container.querySelector('.workout-session-footer .workout-primary-action button').disabled).toBe(false)
    expect(container.querySelector('.set-action.is-executing').disabled).toBe(false)
    await clickAndRender(container.querySelector('.set-action.is-executing'))
    expect(mocks.S.active.entries[0].sets[0].done).toBe(true)
    expect(buttonNamed(container.querySelector('.workout-tools'), 'Adicionar série').disabled).toBe(false)
    expect(container.querySelector('.workout-session-footer .workout-primary-action button').disabled).toBe(false)
  })

  it('locks bottom adjustments during a timed set while keeping Stop and finish available', async () => {
    await mount([exercise('plank', [], { target: { mode: 'time', bodyweight: true }, sets: [
      { sec: 45, done: false }, { sec: 45, done: false },
    ] })])
    mocks.work = { phase: 'work', entryIdx: 0, setIdx: 0, left: 30, total: 45 }
    await act(async () => root.render(<Workout />))
    const toolButtons = container.querySelectorAll('.workout-tools button')
    expect(toolButtons.length).toBeGreaterThan(0)
    expect([...toolButtons].every(button => button.disabled)).toBe(true)
    expect(container.querySelector('.workout-session-footer .workout-primary-action button').disabled).toBe(false)
    expect(container.querySelector('.set-action.is-executing').disabled).toBe(false)
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
    expect(container.querySelector('.set-action')?.disabled).toBe(true)

    await act(async () => { startWorkoutButton().dispatchEvent(new dom.Event('click', { bubbles: true })) })

    expect(mocks.S.active.start).toEqual(expect.any(Number))
    await act(async () => { root.render(React.createElement(Workout)) })
    expect(container.querySelector('.set-start-action')?.disabled).toBe(false)
    expect(container.querySelector('.set-action')?.disabled).toBe(true)
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
    expect([...container.querySelectorAll('.set-action')].every(checkbox => checkbox.disabled)).toBe(true)
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
    await toggleSet(0)
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

    await act(async () => container.querySelector('.set-start-action').click())
    await act(async () => mocks.startWork.mock.calls[0][2](30))

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
