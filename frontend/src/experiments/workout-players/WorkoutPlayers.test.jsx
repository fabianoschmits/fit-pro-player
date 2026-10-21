// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { PlayerLab } from './WorkoutPlayers.jsx'

let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers() })
const click = selector => act(async () => container.querySelector(selector).click())

it('lets an administrator compare ten designs without losing the current workout stage', async () => {
  await act(async () => root.render(<PlayerLab />))
  expect(container.querySelectorAll('[data-player-choice]')).toHaveLength(10)
  await click('.wpl-action')
  expect(container.querySelector('.wpl-design').dataset.phase).toBe('countdown')
  await click('.wpl-action')
  for (const choice of container.querySelectorAll('[data-player-choice]')) {
    await act(async () => choice.click())
    expect(container.querySelector('.wpl-design').dataset.phase).toBe('active')
    expect(container.querySelector('.wpl-action').textContent).toContain('Concluir série')
    expect(container.querySelector('.wpl-clock')).not.toBeNull()
    expect(container.querySelector('.wpl-exercise-demo')).not.toBeNull()
  }
})

it('lets the exercise demonstration pause independently of the running series', async () => {
  await act(async () => root.render(<PlayerLab />))
  await click('.wpl-action')
  await click('.wpl-action')
  expect(container.querySelector('.wpl-exercise-demo').dataset.playing).toBe('true')
  await click('button[aria-label="Pausar demonstração"]')
  expect(container.querySelector('.wpl-exercise-demo').dataset.playing).toBe('false')
  expect(container.querySelector('.wpl-design').dataset.phase).toBe('active')
})

it('shows exercise notices, running time, local history and rest before the next set', async () => {
  await act(async () => root.render(<PlayerLab />))
  await click('.wpl-action')
  await act(async () => vi.advanceTimersByTime(3000))
  expect(container.querySelector('.wpl-readout').textContent).toContain('Execute agora')
  await act(async () => vi.advanceTimersByTime(5000))
  expect(container.querySelector('.wpl-clock').textContent).toContain('0:08')
  await click('.wpl-action')
  expect(container.querySelector('[data-player-history]').textContent).toContain('Barra fixa')
  expect(container.querySelector('.wpl-design').dataset.phase).toBe('rest')
  await act(async () => vi.advanceTimersByTime(15000))
  expect(container.querySelector('.wpl-design').dataset.phase).toBe('ready')
  expect(container.querySelector('.wpl-readout').textContent).toContain('Descanso concluído')
  await click('[data-player-reset]')
  expect(container.querySelector('.wpl-clock').textContent).toContain('0:00')
  expect(container.querySelector('[data-player-history]').textContent).not.toContain('Barra fixa')
})
