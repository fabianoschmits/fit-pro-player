// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button, Check, Switch } from './ui.jsx'

let root, host
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const render = props => act(() => root.render(<Button {...props}>Salvar</Button>))
const click = () => host.querySelector('button').click()
const settle = async fn => act(async () => { fn(); await Promise.resolve() })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

describe('action feedback lifetime', () => {
  it('guards two activations in the same event turn and locks immediately without flashing busy text', async () => {
    const pending = deferred(); let writes = 0
    render({ onAction: () => { writes++; return pending.promise }, loadingLabel: 'Salvando…' })
    act(() => { click(); click() })
    const button = host.querySelector('button')
    expect(writes).toBe(1)
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.textContent).toBe('Salvar')
    act(() => vi.advanceTimersByTime(159))
    expect(button.textContent).toBe('Salvar')
    act(() => vi.advanceTimersByTime(1))
    expect(button.textContent).toBe('Salvando…')
    await settle(() => pending.resolve('written'))
    expect(button.getAttribute('data-state')).toBe('success')
    expect(button.disabled).toBe(false)
    act(() => vi.advanceTimersByTime(600))
    expect(button.textContent).toBe('Salvar')
  })

  it('shows immediate success for fast work and cancels the pending busy visual', async () => {
    const pending = deferred(); const values = []
    render({ onAction: () => pending.promise, onSuccess: result => values.push(result), successLabel: 'Salvo', loadingLabel: 'Salvando…' })
    act(click)
    await settle(() => pending.resolve(42))
    expect(host.querySelector('button').textContent).toBe('Salvo')
    expect(values).toEqual([42])
    act(() => vi.advanceTimersByTime(160))
    expect(host.querySelector('button').textContent).toBe('Salvo')
  })

  it('exposes an error and allows a successful retry without waiting', async () => {
    const failed = deferred(), retried = deferred(); let attempts = 0; const errors = []
    render({ onAction: () => (++attempts === 1 ? failed.promise : retried.promise), onError: error => errors.push(error.message), errorLabel: 'Tentar novamente', successLabel: 'Salvo' })
    act(click)
    await settle(() => failed.reject(new Error('disk full')))
    expect(host.querySelector('button').getAttribute('data-state')).toBe('error')
    expect(host.querySelector('button').textContent).toBe('Tentar novamente')
    expect(errors).toEqual(['disk full'])
    expect(host.querySelector('button').disabled).toBe(false)
    act(click)
    expect(attempts).toBe(2)
    await settle(() => retried.resolve(true))
    expect(host.querySelector('button').textContent).toBe('Salvo')
  })

  it('returns validation and cancellation to idle without success', async () => {
    let successes = 0
    render({ onAction: () => false, onSuccess: () => successes++ })
    await act(async () => { click(); await Promise.resolve() })
    expect(host.querySelector('button').getAttribute('data-state')).toBe('idle')
    expect(host.querySelector('button').disabled).toBe(false)
    expect(successes).toBe(0)
  })

  it('delays controlled busy visuals while locking a native submit action', () => {
    render({ type: 'submit', state: 'uploading', progress: 30, loadingLabel: 'Enviando…' })
    const button = host.querySelector('button')
    expect(button.type).toBe('submit')
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.textContent).toBe('Salvar')
    act(() => vi.advanceTimersByTime(160))
    expect(button.textContent).toBe('Enviando…')
    expect(button.querySelector('.fpp-energy-rail')).not.toBeNull()
    render({ state: 'error', errorLabel: 'Tentar novamente' })
    expect(button.disabled).toBe(false)
    expect(button.textContent).toBe('Tentar novamente')
  })

  it('retains controlled busy feedback when a caller also supplies disabled', () => {
    render({ state: 'processing', disabled: true, loadingLabel: 'Processando…' })
    const button = host.querySelector('button')
    expect(button.getAttribute('aria-busy')).toBe('true')
    act(() => vi.advanceTimersByTime(160))
    expect(button.textContent).toBe('Processando…')
  })

  it('cancels a controlled busy visual if work completes before the threshold', () => {
    render({ state: 'syncing', loadingLabel: 'Atualizando…', successLabel: 'Pronto' })
    act(() => vi.advanceTimersByTime(100))
    render({ state: 'success', loadingLabel: 'Atualizando…', successLabel: 'Pronto' })
    expect(host.querySelector('button').textContent).toBe('Pronto')
    act(() => vi.advanceTimersByTime(100))
    expect(host.querySelector('button').getAttribute('data-visual-state')).toBe('success')
  })

  it('does not unlock a pending write on timers or invoke callbacks after unmount', async () => {
    const pending = deferred(); let callbacks = 0
    render({ onAction: () => pending.promise, onSuccess: () => callbacks++ })
    act(click)
    act(() => vi.advanceTimersByTime(60000))
    expect(host.querySelector('button').disabled).toBe(true)
    act(() => root.render(null))
    expect(vi.getTimerCount()).toBe(0)
    await settle(() => pending.resolve(true))
    expect(callbacks).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps settled operation status and retry when a feedback callback fails', async () => {
    render({ onAction: () => true, onSuccess: () => { throw new Error('observer failed') } })
    await act(async () => { click(); await Promise.resolve() })
    expect(host.querySelector('button').getAttribute('data-state')).toBe('success')
    expect(host.querySelector('button').disabled).toBe(false)
    render({ onAction: () => { throw new Error('write failed') }, onError: async () => { throw new Error('observer failed') } })
    await act(async () => { click(); await Promise.resolve() })
    expect(host.querySelector('button').getAttribute('data-state')).toBe('error')
    expect(host.querySelector('button').disabled).toBe(false)
  })
})

describe('shared control compatibility', () => {
  it('can preserve a custom control appearance while sharing action behavior', async () => {
    render({ appearance: 'custom', className: 'personal-save', onAction: () => true, successLabel: 'Salvo' })
    const button = host.querySelector('button')
    expect(button.classList.contains('btn')).toBe(false)
    expect(button.classList.contains('personal-save')).toBe(true)
    await act(async () => { button.click(); await Promise.resolve() })
    expect(button.getAttribute('data-state')).toBe('success')
    expect(button.textContent).toBe('Salvo')
  })

  it('keeps legacy click, form, ref, variants and original icons without inferring success', async () => {
    let clicks = 0; const ref = React.createRef()
    act(() => root.render(<Button ref={ref} type="submit" variant="danger" size="sm" icon="trash" trailingIcon="chevronRight" className="custom" aria-label="Excluir" onClick={async () => { clicks++ }}>Excluir</Button>))
    const button = host.querySelector('button')
    await act(async () => { button.click(); await Promise.resolve() })
    expect(ref.current).toBe(button)
    expect(button.classList.contains('btn')).toBe(true)
    expect(button.classList.contains('danger')).toBe(true)
    expect(button.classList.contains('sm')).toBe(true)
    expect(button.classList.contains('custom')).toBe(true)
    expect(button.type).toBe('submit')
    expect(button.getAttribute('aria-label')).toBe('Excluir')
    expect(button.querySelectorAll('svg').length).toBe(2)
    expect(button.textContent).toBe('Excluir')
    expect(button.getAttribute('data-state')).toBe('idle')
    expect(clicks).toBe(1)
  })

  it('keeps zero children visible and supports icon-only accessible buttons', () => {
    act(() => root.render(<Button>{0}</Button>))
    expect(host.querySelector('button').textContent).toBe('0')
    act(() => root.render(<Button icon="plus" aria-label="Adicionar" />))
    expect(host.querySelector('button').getAttribute('aria-label')).toBe('Adicionar')
    expect(host.querySelector('svg')).not.toBeNull()
  })

  it('keeps a caller cancellation from starting the managed operation', async () => {
    let writes = 0
    render({ onClick: event => event.preventDefault(), onAction: () => { writes++ } })
    await act(async () => { click(); await Promise.resolve() })
    expect(writes).toBe(0)
    expect(host.querySelector('button').getAttribute('data-state')).toBe('idle')
  })

  it('marks keyboard input for static feedback without delaying action or toggles', async () => {
    let clicks = 0, check = false, toggle = false
    act(() => root.render(<><Button onAction={() => { clicks++; return false }}>Salvar</Button><Check checked={false} onChange={value => { check = value }} /><Switch checked={false} onChange={value => { toggle = value }} /></>))
    const button = host.querySelector('button')
    act(() => button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(button.getAttribute('data-input')).toBe('keyboard')
    await act(async () => { button.click(); await Promise.resolve() })
    act(() => { host.querySelector('[role="checkbox"]').click(); host.querySelector('[role="switch"]').click() })
    expect(clicks).toBe(1)
    expect(check).toBe(true)
    expect(toggle).toBe(true)
    expect(host.querySelector('[role="checkbox"]').getAttribute('aria-busy')).toBeNull()
  })
})
