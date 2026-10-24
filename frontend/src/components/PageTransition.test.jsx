// @vitest-environment happy-dom
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PageTransition from './PageTransition.jsx'

let root, host, animate, animations, originalAnimate, mediaState, mediaQueries

function Editor() {
  const location = useLocation()
  const navigate = useNavigate()
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)
  return <>
    <output data-path>{location.pathname}{location.search}</output>
    {loading && <div data-route-loading>Preparando página</div>}
    <form aria-label="Treino" onSubmit={event => event.preventDefault()}>
      <input aria-label="Nome do treino" defaultValue="Treino A" />
      <button type="button" data-action="count" onClick={() => setCount(value => value + 1)}>Contagem {count}</button>
      <button type="button" data-action="home" onClick={() => navigate('/home')}>Início</button>
      <button type="button" data-action="workout" onClick={() => navigate('/workout')}>Treino</button>
      <button type="button" data-action="stats" onClick={() => navigate('/stats')}>Evolução</button>
      <button type="button" data-action="query" onClick={() => navigate(`${location.pathname}?draft=1`)}>Editar filtro</button>
      <button type="button" data-action="load" onClick={() => { setLoading(true); navigate('/slow') }}>Carregar página</button>
      <button type="button" data-action="ready" onClick={() => setLoading(false)}>Concluir carregamento</button>
    </form>
  </>
}

const render = (Transition = PageTransition) => act(async () => root.render(<MemoryRouter initialEntries={['/home']}><Transition><Editor /></Transition></MemoryRouter>))
const settle = () => act(async () => { await vi.advanceTimersByTimeAsync(20) })
const click = async (action, modality = 'pointer') => {
  await act(async () => {
    const button = host.querySelector(`[data-action="${action}"]`)
    if (modality === 'pointer') button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    button.click()
  })
  await settle()
}
const setReducedMotion = async value => act(async () => {
  mediaState.reduced = value
  for (const [query, media] of mediaQueries) {
    if (!query.includes('prefers-reduced-motion')) continue
    const change = new Event('change')
    Object.defineProperties(change, { matches: { value }, media: { value: query } })
    media.dispatchEvent(change)
  }
})

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  mediaState = { reduced: false, coarse: false }
  mediaQueries = new Map()
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    if (!mediaQueries.has(query)) {
      const media = new EventTarget()
      Object.defineProperties(media, {
        media: { value: query },
        matches: { get: () => query.includes('prefers-reduced-motion') ? mediaState.reduced : query === '(pointer: coarse)' && mediaState.coarse },
      })
      media.addListener = listener => media.addEventListener('change', listener)
      media.removeListener = listener => media.removeEventListener('change', listener)
      mediaQueries.set(query, media)
    }
    return mediaQueries.get(query)
  })
  animations = []
  originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')
  animate = vi.fn(function (keyframes, options) {
    let finish, cancel
    const animation = {
      target: this,
      keyframes,
      options,
      cancel: vi.fn(() => cancel(new DOMException('The animation was canceled.', 'AbortError'))),
      finished: new Promise((resolve, reject) => { finish = resolve; cancel = reject }),
      finish: () => { animation.onfinish?.(); finish(animation) },
      pause: vi.fn(),
      play: vi.fn(),
      commitStyles: vi.fn(),
      currentTime: 0,
      playbackRate: 1,
      onfinish: null,
    }
    animations.push(animation)
    return animation
  })
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, writable: true, value: animate })
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate)
  else delete Element.prototype.animate
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('route transition continuity', () => {
  it('keeps one app surface and preserves the existing form, edits and focus through navigation', async () => {
    await render()
    const app = host.querySelector('#app')
    const form = host.querySelector('form')
    const input = host.querySelector('input')
    input.value = 'Treino com edição pendente'
    input.focus()
    await click('count')
    await click('workout')
    await act(async () => {
      animations.forEach(animation => animation.finish())
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(host.querySelectorAll('#app')).toHaveLength(1)
    expect(host.querySelectorAll('form')).toHaveLength(1)
    expect(host.querySelector('#app')).toBe(app)
    expect(host.querySelector('form')).toBe(form)
    expect(host.querySelector('input')).toBe(input)
    expect(input.value).toBe('Treino com edição pendente')
    expect(document.activeElement).toBe(input)
    expect(host.querySelector('[data-action="count"]').textContent).toBe('Contagem 1')
    expect(host.querySelector('[data-path]').textContent).toBe('/workout')
  })

  it('leaves the initial page and query edits still, then fades only opacity on a pathname change', async () => {
    await render()
    await settle()
    expect(animate).not.toHaveBeenCalled()
    await click('query')
    expect(host.querySelector('[data-path]').textContent).toBe('/home?draft=1')
    expect(animate).not.toHaveBeenCalled()
    await click('workout')
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animations[0].target).toBe(host.querySelector('#app'))
    expect(animations[0].keyframes).toEqual([{ opacity: .65 }, { opacity: 1 }])
    expect(animations[0].options).toMatchObject({ duration: 180 })
    expect(animations[0].options.easing).toMatch(/^cubic-bezier\(/)
  })

  it('also fades navigation on a coarse touch device without replacing the form', async () => {
    mediaState.coarse = true
    // A separate module instance also catches device checks made at import time.
    const TouchPageTransition = (await import('./PageTransition.jsx?coarse-test')).default
    await render(TouchPageTransition)
    const app = host.querySelector('#app')
    await click('stats')
    expect(host.querySelector('#app')).toBe(app)
    expect(host.querySelectorAll('form')).toHaveLength(1)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animations[0].keyframes).toEqual([{ opacity: .65 }, { opacity: 1 }])
  })

  it('cancels an unfinished fade before the next route and on unmount', async () => {
    await render()
    await click('workout')
    expect(animate).toHaveBeenCalledTimes(1)
    const first = animations[0]
    expect(first.cancel).not.toHaveBeenCalled()
    await click('stats')
    expect(first.cancel).toHaveBeenCalledTimes(1)
    expect(animate).toHaveBeenCalledTimes(2)
    const second = animations[1]
    await act(async () => root.render(null))
    expect(second.cancel).toHaveBeenCalledTimes(1)
    expect(host.querySelector('#app')).toBeNull()
  })

  it('keeps reduced-motion navigation instant and cancels a running fade when the preference changes', async () => {
    mediaState.reduced = true
    await render()
    await click('workout')
    expect(host.querySelector('[data-path]').textContent).toBe('/workout')
    expect(animate).not.toHaveBeenCalled()
    await setReducedMotion(false)
    await click('stats')
    expect(animate).toHaveBeenCalledTimes(1)
    const animation = animations[0]
    const app = host.querySelector('#app')
    await setReducedMotion(true)
    expect(animation.cancel).toHaveBeenCalledTimes(1)
    expect(host.querySelector('#app')).toBe(app)
    await click('home')
    expect(animate).toHaveBeenCalledTimes(1)
  })

  it('navigates instantly from the keyboard and restores motion after pointer input', async () => {
    await render()
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    await click('workout', 'keyboard')
    expect(host.querySelector('[data-path]').textContent).toBe('/workout')
    expect(animate).not.toHaveBeenCalled()
    await click('stats')
    expect(animate).toHaveBeenCalledTimes(1)
    const animation = animations[0]
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    await click('home', 'keyboard')
    expect(animation.cancel).toHaveBeenCalledTimes(1)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(host.querySelector('[data-path]').textContent).toBe('/home')
  })

  it('waits for the route loading fallback to disappear before fading the destination', async () => {
    await render()
    await click('load')
    expect(host.querySelector('[data-route-loading]')).not.toBeNull()
    expect(animate).not.toHaveBeenCalled()
    await click('ready')
    expect(host.querySelector('[data-route-loading]')).toBeNull()
    expect(host.querySelector('[data-path]').textContent).toBe('/slow')
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animations[0].target).toBe(host.querySelector('#app'))
  })
})
