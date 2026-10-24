// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import WorkoutExercisePlayer from './WorkoutExercisePlayer.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

let root, container
const clone = value => JSON.parse(JSON.stringify(value))
const rows = () => useStore.getState().S.active.entries[0].sets
const mutate = fn => {
  const S = clone(useStore.getState().S)
  fn(S.active.entries[0])
  useStore.setState({ S })
}
function render(extra = {}) {
  act(() => root.render(<WorkoutExercisePlayer entryIdx={0}
    onField={(i, field, value) => mutate(entry => { entry.sets[i][field] = value })}
    onToggle={i => { useUI.getState().stopManualSet(); mutate(entry => { entry.sets[i].done = !entry.sets[i].done }) }}
    {...extra} />))
}
const click = selector => act(() => container.querySelector(selector).click())

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  vi.setSystemTime(1000000)
  localStorage.clear()
  const S = clone(DEF)
  S.sound = false
  S.effort = 'none'
  S.active = { id: 'player-test', start: 1000, cur: 0, entries: [
    { id: '0001', target: { mode: 'reps', bodyweight: false }, sets: [{ w: 60, r: 8, done: false }, { w: 60, r: 8, done: false }] },
  ] }
  useStore.setState({ S, user: null })
  useUI.setState({ manualSet: null, work: null, timer: null, sheets: [] })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  useUI.getState().stopRest(false)
  useUI.getState().stopWork()
  useUI.setState({ manualSet: null })
  container.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('workout exercise player', () => {
  it('shows the execution signal only while a set is running and removes it on completion and rest', () => {
    render()
    expect(container.querySelector('.wp-execution-signal')).toBeNull()

    click('.wp-main-action')
    expect(container.querySelector('.wp-main-action.is-executing .wp-execution-signal')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.wp-main-action').getAttribute('aria-label')).toBe('Concluir série 1')

    click('.wp-main-action')
    expect(rows().map(row => row.done)).toEqual([true, false])
    expect(container.querySelector('.wp-execution-signal')).toBeNull()

    click('.wp-main-action')
    expect(container.querySelector('.wp-execution-signal')).toBeTruthy()
    act(() => useUI.getState().startRest(5))
    expect(container.querySelector('.wp-main-action.is-resting')).toBeTruthy()
    expect(container.querySelector('.wp-execution-signal')).toBeNull()
    expect(container.querySelector('.wp-main-action').disabled).toBe(true)
  })

  it('starts the pending row without logging and exposes only one completion action', () => {
    render()
    expect(container.querySelector('.wp-series-details').open).toBe(false)
    click('.wp-main-action')
    expect(useUI.getState().manualSet).toMatchObject({ entryIdx: 0, setIdx: 0, sessionId: 'player-test:1000' })
    expect(rows().map(row => row.done)).toEqual([false, false])
    expect(container.querySelectorAll('.set-action.is-executing')).toHaveLength(1)
    expect(container.querySelector('.wp-main-action').getAttribute('aria-label')).toBe('Concluir série 1')
    expect(container.querySelector('.wp-main-action').textContent).toContain('Concluir série')
    expect(container.querySelector('.set-execution-hint').closest('details')).toBeNull()
    click('.wp-main-action')
    expect(rows().map(row => row.done)).toEqual([true, false])
    expect(useUI.getState().manualSet).toBeNull()
  })

  it('requires a fresh start after rest and never allows rest to complete the next row', () => {
    act(() => useUI.getState().startRest(5))
    render()
    expect(container.querySelector('.wp-main-action').disabled).toBe(true)
    expect(container.querySelector('.set-execution-hint.is-resting')).toBeTruthy()
    act(() => useUI.getState().stopRest(false))
    expect(container.querySelector('.wp-main-action').disabled).toBe(false)
    expect(useUI.getState().manualSet).toBeNull()
    expect(rows()[0].done).toBe(false)
  })

  it('stops manual set when stopManualSet is called without logging a set or starting rest', () => {
    render()
    click('.wp-main-action')
    expect(useUI.getState().manualSet).toBeTruthy()
    act(() => useUI.getState().stopManualSet())
    expect(useUI.getState().manualSet).toBeNull()
    expect(useUI.getState().timer).toBeNull()
    expect(rows().map(row => row.done)).toEqual([false, false])
    expect(container.querySelector('.wp-main-action').classList.contains('set-start-action')).toBe(true)
  })

  it('finishes a timed set with elapsed seconds through the existing timer state', () => {
    mutate(entry => { entry.target = { mode: 'time', bodyweight: true }; entry.sets = [{ sec: 45, w: 0, done: false }] })
    render({ onStartTimed: i => useUI.getState().startWork(45, 'Hold', elapsed => {
      mutate(entry => { entry.sets[i].sec = elapsed; entry.sets[i].done = true })
    }, { entryIdx: 0, setIdx: i, isLastSet: true }) })
    click('.wp-main-action')
    expect(container.querySelector('.wp-main-action.is-executing .wp-execution-signal')).toBeTruthy()
    act(() => vi.advanceTimersByTime(12000))
    expect(rows()[0].done).toBe(false)
    click('.wp-main-action')
    expect(rows()[0]).toMatchObject({ done: true, sec: 12 })
    expect(useUI.getState().work.phase).toBe('done')
    expect(container.querySelector('.wp-execution-signal')).toBeNull()
  })

  it('keeps bodyweight unilateral and optional effort controls in the current set', () => {
    mutate(entry => { entry.target = { mode: 'reps', bodyweight: true, side: true, effort: 'rir' }; entry.sets.forEach(row => { row.w = 0 }) })
    render()
    const controls = container.querySelector('.wp-current-controls')
    expect(controls.querySelectorAll('input')).toHaveLength(2)
    expect(controls.querySelector('.eff input').value).toBe('')
    click('.wp-current-controls .w button:last-child')
    expect(rows()[0].r).toBe(10)
    expect(rows()[1].r).toBe(8)
    click('.wp-current-controls .eff button:last-child')
    expect(rows()[0].rir).toBe(0)
  })

  it('keeps locked fields disabled until the workout start callback runs', () => {
    const startWorkout = vi.fn()
    render({ locked: true, onStartWorkout: startWorkout })
    expect([...container.querySelectorAll('.wp-current-controls input, .wp-current-controls button')].every(el => el.disabled)).toBe(true)
    click('.wp-main-action')
    expect(startWorkout).toHaveBeenCalledTimes(1)
    expect(useUI.getState().manualSet).toBeNull()
    expect(rows().every(row => !row.done)).toBe(true)
  })

  it('reopens a completed set from the folded table without starting execution', () => {
    mutate(entry => entry.sets.forEach(row => { row.done = true }))
    render()
    expect(container.querySelector('.wp-main-action')).toBeNull()
    expect(container.querySelector('.wp-series-details').open).toBe(false)
    click('.ex-done-banner')
    expect(container.querySelector('.wp-series-details').open).toBe(true)
    click('.wp-series-details .set-action')
    expect(rows().map(row => row.done)).toEqual([false, true])
    expect(container.querySelector('.set-start-action')).toBeTruthy()
    expect(useUI.getState().manualSet).toBeNull()
  })

  it.each([
    ['loaded', false, 'Peso (kg)'],
    ['added bodyweight', true, 'Extra (kg)'],
  ])('adjusts %s weight by one kilogram without discarding fractional load', (_, bodyweight, label) => {
    mutate(entry => { entry.target.bodyweight = bodyweight; entry.sets[0].w = 60.25 })
    render()
    const field = container.querySelector('.wp-current-controls .w input')
    expect(field.getAttribute('aria-label')).toBe(label)
    expect(field.value).toBe('60.25')

    click('.wp-current-controls .w button:last-child')
    expect(rows()[0].w).toBe(61.25)
    expect(field.value).toBe('61.25')
    click('.wp-current-controls .w button:first-child')
    click('.wp-current-controls .w button:first-child')
    expect(rows()[0].w).toBe(59.25)
    expect(field.value).toBe('59.25')
    expect(rows()[1].w).toBe(60)
  })

  it('keeps decimal weight entry while the kilogram buttons use whole kilogram steps', () => {
    render()
    const field = container.querySelector('.wp-current-controls .w input')
    act(() => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, '12,75')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(rows()[0].w).toBe(12.75)
    click('.wp-current-controls .w button:last-child')
    expect(rows()[0].w).toBe(13.75)
    expect(field.value).toBe('13.75')
  })

  it('converts the pound step back to stored kilograms for added bodyweight load', () => {
    useStore.setState({ S: { ...useStore.getState().S, displayUnit: 'lb' } })
    mutate(entry => { entry.target.bodyweight = true })
    render()
    const field = container.querySelector('.wp-current-controls .w input')
    expect(field.getAttribute('aria-label')).toBe('Extra (lb)')
    click('.wp-current-controls .w button:last-child')
    expect(rows()[0].w).toBe(62.27)
    click('.wp-current-controls .w button:first-child')
    expect(rows()[0].w).toBe(60)
    expect(rows()[1].w).toBe(60)
  })

  it('uses minutes and speed for cardio while retaining the manual execution flow', () => {
    mutate(entry => { entry.target = { mode: 'cardio' }; entry.sets = [{ min: 20, speed: 8, done: false }] })
    render()
    click('.wp-current-controls .w button:last-child')
    click('.wp-current-controls .r button:last-child')
    expect(rows()[0]).toMatchObject({ min: 21, speed: 8.5, done: false })
    click('.wp-main-action')
    expect(useUI.getState().manualSet).toMatchObject({ setIdx: 0 })
    expect(rows()[0].done).toBe(false)
  })

  it('displays the execution clock in the media card and adds a set from the series details card', () => {
    const onAddSet = vi.fn()
    render({ onAddSet })
    expect(container.querySelector('.wp-media-card .wp-card-clock')).toBeTruthy()
    const addButton = container.querySelector('.wp-series-details .wp-add-set-btn')
    expect(addButton).toBeTruthy()
    click('.wp-series-details .wp-add-set-btn')
    expect(onAddSet).toHaveBeenCalledTimes(1)
  })

  it('renders Repetições label and spawns floating animation on bump buttons', () => {
    render()
    expect(container.textContent).toContain('Repetições')
    expect(container.querySelector('.wp-bump-float')).toBeNull()
    click('.wp-current-controls .w button:last-child')
    expect(container.querySelector('.wp-bump-float--plus')?.textContent).toBe('+')
    click('.wp-current-controls .w button:first-child')
    expect(container.querySelector('.wp-bump-float--minus')?.textContent).toBe('−')
  })

  it('explains repetitions and RIR from the compact labels without changing the set controls', () => {
    mutate(entry => { entry.target.effort = 'rir' })
    render()

    const reps = [...container.querySelectorAll('.wp-metric-label')].find(node => node.textContent === 'Repetições')
    expect(reps.tagName).toBe('BUTTON')
    act(() => reps.click())
    expect(container.textContent).toContain('Quantidade de vezes que você executa o movimento nesta série.')

    const rir = [...container.querySelectorAll('.wp-metric-label')].find(node => node.textContent === 'RIR')
    act(() => rir.click())
    expect(container.textContent).toContain('Repetições em reserva: quantas você ainda conseguiria fazer antes da falha.')

    mutate(entry => { entry.target.effort = 'rpe' })
    render()
    const rpe = [...container.querySelectorAll('.wp-metric-label')].find(node => node.textContent === 'RPE')
    act(() => rpe.click())
    expect(container.textContent).toContain('Esforço percebido: o quão perto da falha esta série ficou, numa escala de 1 a 10.')
  })
})
