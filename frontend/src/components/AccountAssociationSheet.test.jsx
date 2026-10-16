// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountAssociationSheet } from './AccountAssociationSheet.jsx'

let container, root, close, onChoice
const choice = label => [...container.querySelectorAll('button')].find(button => button.textContent.includes(label))
const click = async (button, detail = 0) => act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail })))
const advance = async ms => act(async () => vi.advanceTimersByTimeAsync(ms))

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  root = createRoot(container)
  document.body.appendChild(container)
  close = vi.fn()
  onChoice = vi.fn().mockResolvedValue(undefined)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

const render = async () => act(async () => root.render(<AccountAssociationSheet close={close} onChoice={onChoice} />))

describe('AccountAssociationSheet', () => {
  it('offers explicit choices and activates programmatic selection immediately', async () => {
    await render()
    expect(container.textContent).toContain('Usar dados deste dispositivo')
    expect(container.textContent).toContain('Usar dados da nuvem')
    expect(container.textContent).toContain('Manter separados')
    await click(choice('Manter separados'))
    expect(onChoice).toHaveBeenCalledWith('keep-separate')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('waits for pointer activation and confirmation before closing', async () => {
    vi.useFakeTimers()
    await render()
    const selected = choice('Usar dados deste dispositivo')
    await click(selected, 1)
    expect(onChoice).not.toHaveBeenCalled()
    await advance(319)
    expect(onChoice).not.toHaveBeenCalled()
    await advance(1)
    expect(onChoice).toHaveBeenCalledWith('use-device')
    expect(selected.dataset.state).toBe('success')
    expect(close).not.toHaveBeenCalled()
    await click(choice('Usar dados da nuvem'))
    expect(onChoice).toHaveBeenCalledTimes(1)
    await advance(519)
    expect(close).not.toHaveBeenCalled()
    await advance(1)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed choice open with its error and permits a retry', async () => {
    onChoice.mockRejectedValueOnce(new Error('Falha ao associar'))
    await render()
    await click(choice('Usar dados da nuvem'))
    expect(container.querySelector('[role="alert"]').textContent).toBe('Falha ao associar')
    expect(close).not.toHaveBeenCalled()
    expect([...container.querySelectorAll('button')].every(button => !button.disabled)).toBe(true)
    await click(container.querySelector('button[data-state="error"]'))
    expect(onChoice).toHaveBeenCalledTimes(2)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('keeps reduced-motion pointer selection immediate', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true })
    await render()
    await click(choice('Manter separados'), 1)
    expect(onChoice).toHaveBeenCalledWith('keep-separate')
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not close after unmount during pointer confirmation', async () => {
    vi.useFakeTimers()
    await render()
    await click(choice('Manter separados'), 1)
    await advance(320)
    expect(onChoice).toHaveBeenCalledTimes(1)
    await act(async () => root.render(null))
    await advance(520)
    expect(close).not.toHaveBeenCalled()
  })

  it('guards all choices before React renders the pending state', async () => {
    let resolve
    onChoice.mockReturnValue(new Promise(done => { resolve = done }))
    await render()
    const device = choice('Usar dados deste dispositivo'), cloud = choice('Usar dados da nuvem')
    await act(async () => {
      device.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      cloud.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(onChoice).toHaveBeenCalledTimes(1)
    expect([...container.querySelectorAll('button')].every(button => button.disabled)).toBe(true)
    await act(async () => resolve())
    expect(close).toHaveBeenCalledTimes(1)
  })
})
