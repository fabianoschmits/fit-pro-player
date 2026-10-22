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
    return args.reduce((text, arg, index) => String(text).replace(`{${index}}`, arg), value)
  },
  dateLocale: () => 'pt-BR',
}))
vi.mock('../lib/history.js', () => ({
  setLabel: () => '62,5 kg × 8',
}))
vi.mock('../lib/exercises.js', () => {
  const ids = ['0025', '0043', '0032', '0198']
  const EXIDX = Object.fromEntries(ids.map((id, index) => [id, { id, n: `Exercise ${index + 1}`, eq: 'barbell', bp: 'chest' }]))
  return {
    EXIDX,
    exerciseName: exercise => exercise.n,
    exOr: id => EXIDX[id] || { id, n: id },
  }
})
vi.mock('../lib/exercise-guide-assets.js', () => ({
  EXERCISE_SPRITE_POPULARITY_IDS: ['0025', '0043', '0032', '0198'],
}))
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
  mocks.standalone = true
  mocks.auth = { configured: false }
  mocks.storeState = { S: { mediaSize: 'full', displayUnit: 'kg', exWeights: {}, active: null }, enterApp: null, setGuest: null }
  dom = new Window({ url: 'http://localhost/' })
  dom.matchMedia = () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  globalThis.window = dom
  globalThis.document = dom.document
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.navigator })
  for (const key of ['HTMLElement', 'HTMLIFrameElement', 'Node', 'Element', 'Event', 'MouseEvent', 'KeyboardEvent', 'PointerEvent']) {
    globalThis[key] = dom[key] || globalThis[key]
  }
  if (!globalThis.PointerEvent) {
    globalThis.PointerEvent = class PointerEvent extends dom.Event {
      constructor(type, init = {}) { super(type, init) }
    }
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
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
    expect(container.querySelector('.landing-hero-copy h1')?.textContent).toContain('Seu treino, no bolso')
    expect(container.querySelector('.landing-hero-copy p')?.textContent).toMatch(/Plano do dia/i)
    expect(container.querySelector('.landing-block-copy h2')?.textContent).toBe('Treino')
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

  it('lets visitors switch body analysis views without changing the fixed muscle list', async () => {
    await act(async () => { root.render(<Landing />) })

    expect(container.querySelector('.landing-muscle-stats')).toBeTruthy()
    expect(container.textContent).toContain('Costas superior')
    expect(container.textContent).toContain('Ombros')
    expect(container.textContent).toContain('Tríceps')
    expect(container.textContent).toContain('Bíceps')

    await act(async () => { button('Fadiga').dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(button('Fadiga').getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.landing-muscle-stats').textContent).toContain('Costas superior')

    await act(async () => { button('Fadiga').dispatchEvent(new dom.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })) })
    expect(button('Força').getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('.landing-muscle-stats').textContent).toContain('17')
  })

  it('auto-advances workout exercises and lets next/prev take over', async () => {
    await act(async () => { root.render(<Landing />) })

    const media = () => container.querySelector('.wp-media-card [data-media]')?.closest('[data-exercise]') || container.querySelector('.wp-media [data-exercise]')
    expect(media().getAttribute('data-exercise')).toBe('0025')

    await act(async () => { await vi.advanceTimersByTimeAsync(3500) })
    expect(media().getAttribute('data-exercise')).toBe('0043')

    const next = container.querySelector('.wp-exercise-nav--next')
    const prev = container.querySelector('.wp-exercise-nav--previous')
    expect(next.disabled).toBe(false)

    await act(async () => { next.dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(media().getAttribute('data-exercise')).toBe('0032')

    await act(async () => { await vi.advanceTimersByTimeAsync(7000) })
    expect(media().getAttribute('data-exercise')).toBe('0032')

    await act(async () => { prev.dispatchEvent(new dom.MouseEvent('click', { bubbles: true })) })
    expect(media().getAttribute('data-exercise')).toBe('0043')
  })

  it('auto-plays weight history until the visitor interacts with the chart', async () => {
    await act(async () => { root.render(<Landing />) })

    const reading = () => container.querySelector('.home-weight-reading strong')?.textContent
    const first = reading()
    await act(async () => { await vi.advanceTimersByTimeAsync(1800) })
    expect(reading()).not.toBe(first)

    const chart = container.querySelector('.landing-weight-interactive')
    await act(async () => { chart.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })) })
    const frozen = reading()
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(reading()).toBe(frozen)
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
