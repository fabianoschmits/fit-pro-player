// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./components/Media.jsx', () => ({
  default: ({ ex }) => <div className="mock-media" data-exercise-id={ex.id} />,
  Thumb: ({ ex }) => <span className="thumb" data-thumb-id={ex.id} />,
}))
vi.mock('./lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

import { exercisePicker } from './sheets.jsx'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const clone = value => JSON.parse(JSON.stringify(value))
let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  const state = clone(DEF)
  state.onboardingDone = true
  useStore.setState({ S: state, user: null })
  useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('exercise picker preview', () => {
  it('previews the exercise before adding it', () => {
    const onPick = vi.fn()
    exercisePicker(onPick, { quickAdd: true })
    const sheet = useUI.getState().sheets[0]

    act(() => root.render(sheet.render(vi.fn())))
    const firstExercise = container.querySelector('.picker-item-main')
    const exerciseId = firstExercise.querySelector('[data-thumb-id]').dataset.thumbId

    expect(container.querySelector('.exercise-picker-preview')).toBeNull()
    expect(onPick).not.toHaveBeenCalled()

    act(() => firstExercise.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(firstExercise.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('.mock-media').dataset.exerciseId).toBe(exerciseId)
    expect(onPick).not.toHaveBeenCalled()

    const addButton = container.querySelector('.exercise-picker-preview-actions .btn.primary')
    act(() => addButton.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0][0].id).toBe(exerciseId)
    expect(onPick.mock.calls[0][1]).toEqual({})
  })

  it('moves the preview to the newly tapped exercise without choosing either one', () => {
    const onPick = vi.fn()
    exercisePicker(onPick)
    const sheet = useUI.getState().sheets[0]

    act(() => root.render(sheet.render(vi.fn())))
    const rows = [...container.querySelectorAll('.picker-item-main')]
    const secondId = rows[1].querySelector('[data-thumb-id]').dataset.thumbId

    act(() => rows[0].dispatchEvent(new MouseEvent('click', { bubbles: true })))
    act(() => rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelectorAll('.exercise-picker-preview')).toHaveLength(1)
    expect(container.querySelector('.mock-media').dataset.exerciseId).toBe(secondId)
    expect(rows[0].getAttribute('aria-expanded')).toBe('false')
    expect(rows[1].getAttribute('aria-expanded')).toBe('true')
    expect(onPick).not.toHaveBeenCalled()
  })
})
