import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Landing, { buildWeightPreviewPoints } from './Landing.jsx'

const mocks = vi.hoisted(() => ({
  setGuest: vi.fn(),
  openSheet: vi.fn(),
}))

vi.mock('../store/useStore.js', () => ({
  hasData: () => false,
  useStore: selector => selector
    ? selector({ config: null, S: {} })
    : { setUser: vi.fn(), pullState: vi.fn(), setGuest: mocks.setGuest },
}))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn(), openSheet: mocks.openSheet }) } }))
vi.mock('../lib/api.js', () => ({
  BIO: 'your fingerprint, face or PIN', webauthnOK: () => true,
  passkeyLogin: vi.fn(), passkeyRegister: vi.fn(),
}))
vi.mock('../lib/demo.js', () => ({ DEMO: false, STANDALONE: true, REPO: 'https://example.com/repo' }))
vi.mock('../lib/i18n.js', () => ({ t: value => value === 'your fingerprint, face or PIN' ? 'biometria ou PIN' : value }))
vi.mock('../lib/exercises.js', () => {
  const ids = ['0025', '0043', '0032', '0198', '0334']
  return {
    EXIDX: Object.fromEntries(ids.map((id, index) => [id, { id, n: `Exercise ${index + 1}`, eq: 'barbell' }])),
    exerciseName: exercise => exercise.n,
  }
})
vi.mock('../components/ExerciseGuideAnimation.jsx', () => ({
  default: ({ ex, playing }) => React.createElement('div', { 'data-exercise': ex.id, 'data-playing': playing }),
}))
vi.mock('../components/BodyMap.jsx', () => ({
  default: props => React.createElement('div', { 'data-body': props.body, 'data-thresholds': !!props.thresholds }),
}))
vi.mock('../components/LineChart.jsx', () => ({
  default: props => React.createElement('div', { 'data-points': props.points.length, 'data-goal': props.goal }),
}))
vi.mock('../components/Icon.jsx', () => ({ default: ({ name }) => React.createElement('span', { 'data-icon': name }) }))

let dom
let root
let container

beforeEach(() => {
  vi.useFakeTimers()
  dom = new Window({ url: 'http://localhost/' })
  dom.matchMedia = () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'HTMLIFrameElement', 'Node', 'Element', 'Event', 'MouseEvent']) globalThis[key] = dom[key]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => { root.unmount() })
  dom.close()
  vi.useRealTimers()
  vi.clearAllMocks()
})

const button = label => [...container.querySelectorAll('button')].find(item => item.textContent.trim() === label)

describe('public landing page', () => {
  it('shows the product story and enters the standalone app explicitly', async () => {
    await act(async () => { root.render(<Landing />) })

    expect(container.querySelector('h1').textContent).toContain('Seu treino fica mais claro')
    expect(container.querySelectorAll('[data-exercise]').length).toBe(11)
    expect(container.querySelector('[data-points]').getAttribute('data-points')).toBe('9')
    expect(container.querySelector('[data-body]').getAttribute('data-body')).toBe('male')
    expect(button('Equilíbrio muscular').getAttribute('aria-selected')).toBe('true')

    await act(async () => { button('Começar agora').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(mocks.setGuest).toHaveBeenCalledWith(true)
  })

  it('cycles the statistics preview and lets the visitor pause all ambient motion', async () => {
    await act(async () => { root.render(<Landing />) })

    await act(async () => { await vi.advanceTimersByTimeAsync(4200) })
    expect(button('Fadiga').getAttribute('aria-selected')).toBe('true')
    expect(container.textContent).toContain('Recuperação em andamento')

    await act(async () => { button('Pausar animações').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(button('Continuar animações')).toBeTruthy()
    expect(container.querySelector('.landing-exercise-track').classList.contains('is-paused')).toBe(true)

    await act(async () => { await vi.advanceTimersByTimeAsync(8400) })
    expect(button('Fadiga').getAttribute('aria-selected')).toBe('true')
  })

  it('builds a marked one-month weight-loss series', () => {
    const points = buildWeightPreviewPoints(Date.UTC(2026, 8, 8, 12))
    expect(points).toHaveLength(9)
    expect(points[0].y).toBe(82.4)
    expect(points.at(-1).y).toBe(79.8)
    expect(points.every((point, index) => index === 0 || point.t > points[index - 1].t)).toBe(true)
    expect(points.every(point => point.m > 0)).toBe(true)
  })
})
