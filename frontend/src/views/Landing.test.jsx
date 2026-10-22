import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Landing, { buildWeightPreviewPoints } from './Landing.jsx'

const mocks = vi.hoisted(() => ({
  setGuest: vi.fn(),
  openSheet: vi.fn(),
  openAuthSheet: vi.fn(),
  standalone: true,
  auth: { configured: false },
  storeState: { S: { mediaSize: 'full', displayUnit: 'kg', exWeights: {}, active: null }, enterApp: null, setGuest: null },
}))

vi.mock('../store/useStore.js', () => {
  const useStore = selector => {
    const state = {
      ...mocks.storeState,
      enterApp: mocks.setGuest,
      setGuest: mocks.setGuest,
    }
    return selector ? selector(state) : state
  }
  useStore.getState = () => ({
    ...mocks.storeState,
    enterApp: mocks.setGuest,
    setGuest: mocks.setGuest,
  })
  useStore.setState = partial => {
    mocks.storeState = { ...mocks.storeState, ...partial, S: partial.S ?? mocks.storeState.S }
  }
  return { hasData: () => false, useStore }
})
vi.mock('../store/useUI.js', () => ({
  useUI: Object.assign(selector => selector ? selector({ work: null, timer: null, manualSet: null }) : {}, {
    getState: () => ({ toast: vi.fn(), openSheet: mocks.openSheet, work: null, timer: null, manualSet: null }),
  }),
}))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => mocks.auth }))
vi.mock('../components/AuthSheet.jsx', () => ({ openAuthSheet: mocks.openAuthSheet }))
vi.mock('../lib/demo.js', () => ({ DEMO: false, get STANDALONE() { return mocks.standalone } }))
vi.mock('../lib/i18n.js', () => ({
  t: (value, ...args) => {
    if (value === 'your fingerprint, face or PIN') return 'biometria ou PIN'
    if (args.length) return String(value).replace('{0}', args[0])
    return value
  },
  dateLocale: () => 'pt-BR',
}))
vi.mock('../lib/history.js', () => ({
  setLabel: () => '62,5 kg × 8',
}))
vi.mock('../lib/exercises.js', () => {
  const ids = ['0025', '0043', '0032']
  const EXIDX = Object.fromEntries(ids.map((id, index) => [id, { id, n: `Exercise ${index + 1}`, eq: 'barbell', bp: 'chest' }]))
  return {
    EXIDX,
    exerciseName: exercise => exercise.n,
    exOr: id => EXIDX[id] || { id, n: id },
  }
})
vi.mock('../components/Media.jsx', () => ({
  default: ({ ex }) => React.createElement('div', { 'data-exercise': ex.id, 'data-media': '1' }),
}))
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
  mocks.standalone = true
  mocks.auth = { configured: false }
  mocks.storeState = { S: { mediaSize: 'full', displayUnit: 'kg', exWeights: {}, active: null }, enterApp: null, setGuest: null }
  dom = new Window({ url: 'http://localhost/' })
  dom.matchMedia = () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'HTMLIFrameElement', 'Node', 'Element', 'Event', 'MouseEvent', 'KeyboardEvent']) globalThis[key] = dom[key]
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
  it('keeps a short mobile-first product page without marketing filler', async () => {
    await act(async () => { root.render(<Landing />) })

    expect(container.querySelector('.landing-page')).toBeTruthy()
    expect(container.querySelector('.landing-stage')).toBeTruthy()
    expect(container.querySelectorAll('.landing-phone').length).toBeGreaterThanOrEqual(2)
    expect(container.querySelector('[data-landing-promo-video]')).toBeNull()
    expect(container.querySelector('.landing-trust')).toBeNull()
    expect(container.querySelector('.landing-eyebrow')).toBeNull()
    expect(container.querySelector('.landing-feature-list')).toBeNull()
    expect(container.querySelector('.landing-final-cta')).toBeNull()
    expect(container.querySelector('.landing-nav nav')).toBeNull()
    expect(container.textContent).not.toContain('Como funciona')
    expect(container.textContent).not.toContain('BIBLIOTECA VISUAL')
  })

  it('shows real home and workout screen markup, then enters the app', async () => {
    await act(async () => { root.render(<Landing />) })

    expect(container.querySelector('.landing-hero-logo')).toBeTruthy()
    expect(container.querySelector('h1')).toBeTruthy()
    expect(container.querySelector('.home-view .home-now--planned')).toBeTruthy()
    expect(container.querySelector('.home-week-strip .wday')).toBeTruthy()
    expect(container.querySelector('.home-weight-block [data-points]')).toBeTruthy()
    expect(container.querySelector('.workout-player-page .wp-exercise-player')).toBeTruthy()
    expect(container.querySelector('.wp-media-card [data-media]')).toBeTruthy()
    expect(container.querySelector('[data-body]').getAttribute('data-body')).toBe('male')
    expect(button('Equilíbrio')).toBeTruthy()
    expect(container.querySelector('.landing-nav-cta--accent')).toBeTruthy()
    expect(container.textContent).not.toContain('Supabase')

    await act(async () => { button('Começar agora').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(mocks.setGuest).toHaveBeenCalledWith(true)
  })

  it('removes passkey registration from the landing', async () => {
    mocks.standalone = false
    mocks.auth = { configured: true, status: 'authenticated', user: { id: 'supabase-user' } }

    await act(async () => { root.render(<Landing />) })

    expect(container.textContent).not.toContain('Criar novo perfil')
    expect(container.textContent).not.toContain('Create passkey profile')
  })

  it('offers non-blocking account protection on a configured web app', async () => {
    mocks.standalone = false
    mocks.auth = { configured: true }

    await act(async () => { root.render(<Landing />) })

    expect(button('Protect your training')).toBeTruthy()
    await act(async () => { button('Protect your training').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(mocks.openAuthSheet).toHaveBeenCalledWith('entry')
  })

  it('offers Supabase account entry on the configured web app', async () => {
    mocks.standalone = false
    mocks.auth = { configured: true }

    await act(async () => { root.render(<Landing />) })
    expect(button('Entrar ou criar conta')).toBeTruthy()

    await act(async () => { button('Entrar ou criar conta').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(mocks.openAuthSheet).toHaveBeenCalledWith('entry')
  })

  it('lets visitors switch body analysis views', async () => {
    await act(async () => { root.render(<Landing />) })

    await act(async () => { button('Fadiga').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(button('Fadiga').getAttribute('aria-selected')).toBe('true')

    await act(async () => { button('Fadiga').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
    expect(button('Força').getAttribute('aria-selected')).toBe('true')
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
