// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button, Check, Switch } from './ui.jsx'
import { useStore } from '../store/useStore.js'

let root, host
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const render = props => act(() => root.render(<Button {...props}>Salvar</Button>))
const click = () => host.querySelector('button').click()
const settle = async fn => act(async () => { fn(); await Promise.resolve(); await Promise.resolve() })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

describe('action feedback lifetime', () => {
  it('keeps persistence presentation silent while the real write and continuation finish', async () => {
    const pending = deferred(); const completed = vi.fn()
    let writes = 0
    render({ feedback: 'persistence', icon: 'check', onAction: () => { writes++; return pending.promise }, onSuccess: completed, loadingLabel: 'Salvando…', successLabel: 'Salvo' })
    act(() => {
      const activate = () => host.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
      activate(); activate()
    })
    await act(async () => { vi.advanceTimersByTime(320); await Promise.resolve() })
    const button = host.querySelector('button')
    act(() => vi.advanceTimersByTime(600))
    expect(writes).toBe(1)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toBe('Salvar')
    expect(button.getAttribute('aria-busy')).toBeNull()
    expect(button.querySelector('[aria-live], .fpp-status-animation, .fpp-energy-rail')).toBeNull()
    expect(button.querySelector('[data-label="Salvando…"], [data-label="Salvo"]')).toBeNull()
    await settle(() => pending.resolve('written'))
    expect(button.textContent).toBe('Salvar')
    expect(button.getAttribute('data-visual-state')).toBe('idle')
    expect(button.disabled).toBe(true)
    await act(async () => { vi.advanceTimersByTime(520); await Promise.resolve(); await Promise.resolve() })
    expect(completed).toHaveBeenCalledExactlyOnceWith('written')
    expect(button.disabled).toBe(false)
    expect(button.querySelector('.fpp-status-animation')).toBeNull()
  })

  it('retains explicit persistence errors and permits retry without a success announcement', async () => {
    const error = new Error('disk full'); const observed = vi.fn()
    let attempts = 0
    render({ feedback: 'persistence', onAction: () => { if (++attempts === 1) throw error; return true }, onError: observed, errorLabel: 'Tentar novamente', successLabel: 'Salvo' })
    await act(async () => { click(); await Promise.resolve(); await Promise.resolve() })
    const button = host.querySelector('button')
    expect(button.textContent).toBe('Tentar novamente')
    expect(button.getAttribute('data-visual-state')).toBe('error')
    expect(observed).toHaveBeenCalledExactlyOnceWith(error)
    expect(button.disabled).toBe(false)
    await act(async () => { click(); await Promise.resolve(); await Promise.resolve() })
    expect(attempts).toBe(2)
    expect(button.textContent).toBe('Salvar')
    expect(button.querySelector('[aria-live], .fpp-status-animation')).toBeNull()
  })

  it('confirms an account edit locally while the background queue is pending', async () => {
    await useStore.getState().activateLocalScope('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    const pending = deferred()
    useStore.getState().configureAccountSync(() => pending.promise)
    render({ onAction: () => useStore.getState().update(state => { state.profile.name = 'Ana' }), successLabel: 'Salvo', loadingLabel: 'Sincronizando…' })
    await act(async () => { click(); await Promise.resolve(); await Promise.resolve() })
    expect(useStore.getState().S._pendingSync.preferences).toBe(true)
    expect(host.querySelector('button').getAttribute('data-state')).toBe('success')
    await settle(() => { useStore.setState(state => ({ S: { ...state.S, _pendingSync: { preferences: false } } })); pending.resolve() })
    expect(host.querySelector('button').getAttribute('data-state')).toBe('success')
    useStore.getState().releaseAccountSync()
    await useStore.getState().activateLocalScope(null)
  })
  it('confirms the local save while account synchronization continues in the background', async () => {
    await useStore.getState().activateLocalScope('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    useStore.getState().configureAccountSync(() => Promise.resolve())
    const completed = vi.fn()
    render({ onAction: () => useStore.getState().update(state => { state.profile.name = 'Bia' }), onSuccess: completed, successLabel: 'Salvo' })
    await act(async () => { click(); await Promise.resolve(); await Promise.resolve() })
    expect(host.querySelector('button').getAttribute('data-state')).toBe('success')
    expect(host.querySelector('button').textContent).toBe('Salvo')
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); await Promise.resolve() })
    expect(completed).toHaveBeenCalledOnce()
    useStore.getState().releaseAccountSync()
    await useStore.getState().activateLocalScope(null)
  })
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
    act(() => vi.advanceTimersByTime(219))
    expect(button.textContent).toBe('Salvar')
    act(() => vi.advanceTimersByTime(1))
    expect(button.textContent).toBe('Salvando…')
    await settle(() => pending.resolve('written'))
    await act(async () => { vi.advanceTimersByTime(280); await Promise.resolve(); await Promise.resolve() })
    expect(button.getAttribute('data-state')).toBe('success')
    expect(button.disabled).toBe(false)
    await act(async () => { vi.advanceTimersByTime(900); await Promise.resolve(); await Promise.resolve() })
    expect(button.textContent).toBe('Salvar')
  })

  it('shows immediate success for fast work and cancels the pending busy visual', async () => {
    const pending = deferred(); const values = []
    render({ onAction: () => pending.promise, onSuccess: result => values.push(result), successLabel: 'Salvo', loadingLabel: 'Salvando…' })
    act(click)
    await settle(() => pending.resolve(42))
    await act(async () => { vi.advanceTimersByTime(280); await Promise.resolve(); await Promise.resolve() })
    expect(host.querySelector('button').textContent).toBe('Salvo')
    expect(values).toEqual([42])
    act(() => vi.advanceTimersByTime(220))
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
    await act(async () => { vi.advanceTimersByTime(280); await Promise.resolve(); await Promise.resolve() })
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
    act(() => vi.advanceTimersByTime(220))
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
    act(() => vi.advanceTimersByTime(220))
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
    await act(async () => { vi.advanceTimersByTime(280); await Promise.resolve(); await Promise.resolve() })
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
    act(() => vi.advanceTimersByTime(280))
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

describe('pointer activation sequence', () => {
  const pointerClick = () => host.querySelector('button').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
  const advance = async ms => act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve(); await Promise.resolve() })

  it('shows the press before starting a primary operation and rejects repeat taps', async () => {
    const pending = deferred(), save = vi.fn(() => pending.promise)
    render({ onAction: save })
    act(() => { pointerClick(); pointerClick() })
    expect(save).not.toHaveBeenCalled()
    expect(host.querySelector('button').getAttribute('data-visual-state')).toBe('pressed')
    expect(host.querySelector('button').disabled).toBe(true)
    await advance(319)
    expect(save).not.toHaveBeenCalled()
    await advance(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(host.querySelector('button').getAttribute('data-state')).toBe('loading')
  })

  it('keeps successful confirmation visible before running the continuation', async () => {
    const save = vi.fn(() => true), leave = vi.fn()
    render({ onAction: save, onSuccess: leave, successLabel: 'Salvo' })
    act(pointerClick)
    await advance(320)
    expect(host.querySelector('button').textContent).toBe('Salvo')
    expect(leave).not.toHaveBeenCalled()
    act(pointerClick)
    expect(save).toHaveBeenCalledTimes(1)
    await advance(519)
    expect(leave).not.toHaveBeenCalled()
    await advance(1)
    expect(leave).toHaveBeenCalledTimes(1)
  })

  it('also presents the press before a legacy navigation callback and preserves its target', async () => {
    const navigate = vi.fn()
    render({ onClick: event => navigate(event.currentTarget, event.detail) })
    const button = host.querySelector('button')
    act(pointerClick)
    expect(navigate).not.toHaveBeenCalled()
    await advance(320)
    expect(navigate).toHaveBeenCalledWith(button, 1)
    expect(button.getAttribute('data-state')).toBe('idle')
  })

  it('defers native submit once, retaining validation and the original submitter', async () => {
    const submit = vi.fn(event => event.preventDefault()), clicked = vi.fn()
    act(() => root.render(<form onSubmit={submit}><input name="title" required defaultValue="Treino" /><Button type="submit" onClick={clicked}>Salvar</Button></form>))
    const button = host.querySelector('button')
    act(pointerClick)
    expect(submit).not.toHaveBeenCalled()
    await advance(320)
    expect(clicked).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit.mock.calls[0][0].nativeEvent.submitter).toBe(button)
    host.querySelector('input').value = ''
    act(pointerClick)
    await advance(320)
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('cancels an activation if the control is disabled or unmounted before execution', async () => {
    const save = vi.fn()
    render({ onAction: save })
    act(pointerClick)
    render({ onAction: save, disabled: true })
    await advance(320)
    expect(save).not.toHaveBeenCalled()
    render({ onAction: save })
    act(pointerClick)
    act(() => root.render(null))
    await advance(320)
    expect(save).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not defer quick actions or operations that need the original browser gesture', async () => {
    const quick = vi.fn(), permission = vi.fn()
    render({ intent: 'quick', onAction: quick })
    act(pointerClick)
    expect(quick).toHaveBeenCalledTimes(1)
    await advance(0)
    render({ activation: 'immediate', onAction: permission })
    act(pointerClick)
    expect(permission).toHaveBeenCalledTimes(1)
    await advance(0)
  })

  it('executes immediately with reduced motion and keeps caller cancellation intact', async () => {
    const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true })
    const save = vi.fn()
    render({ onAction: save })
    act(pointerClick)
    expect(save).toHaveBeenCalledTimes(1)
    media.mockRestore()
    render({ onClick: event => event.preventDefault(), onAction: save })
    act(pointerClick)
    await advance(320)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('cancels a queued action when the route changes and cancels confirmation on unmount', async () => {
    const save = vi.fn(() => true), leave = vi.fn()
    render({ onAction: save, onSuccess: leave })
    act(pointerClick)
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))
    await advance(320)
    expect(save).not.toHaveBeenCalled()
    act(pointerClick)
    await advance(320)
    expect(save).toHaveBeenCalledTimes(1)
    act(() => root.render(null))
    await advance(520)
    expect(leave).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
