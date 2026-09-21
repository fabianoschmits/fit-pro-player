// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const pushMocks = vi.hoisted(() => ({
  sendTestPush: vi.fn(),
}))

vi.mock('../lib/push.js', () => ({
  pushSupported: () => true,
  enablePush: vi.fn(),
  disablePush: vi.fn(),
  sendTestPush: pushMocks.sendTestPush,
}))

import { PushCard } from './Settings.jsx'

let container
let root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  pushMocks.sendTestPush.mockReset().mockResolvedValue({ ok: true })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} })
  Object.defineProperty(window, 'Notification', { configurable: true, value: { permission: 'granted' } })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue({ endpoint: 'test' }) } }) },
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('sends a test notification and reports completion', async () => {
  const toast = vi.fn()
  await act(async () => {
    root.render(<PushCard S={{ reminder: { on: false } }} update={vi.fn()} toast={toast} />)
    await Promise.resolve()
    await Promise.resolve()
  })
  const button = [...container.querySelectorAll('button')].find(item => item.textContent.includes('Enviar notificação de teste'))
  expect(button).toBeTruthy()

  await act(async () => { button.click(); await Promise.resolve() })

  expect(pushMocks.sendTestPush).toHaveBeenCalledTimes(1)
  expect(toast).toHaveBeenCalledWith('Teste enviado — deve chegar a qualquer segundo')
})

it('reports a test-notification failure without changing the subscription', async () => {
  const toast = vi.fn()
  pushMocks.sendTestPush.mockRejectedValue(new Error('push unavailable'))
  await act(async () => {
    root.render(<PushCard S={{ reminder: { on: false } }} update={vi.fn()} toast={toast} />)
    await Promise.resolve()
    await Promise.resolve()
  })
  const button = [...container.querySelectorAll('button')].find(item => item.textContent.includes('Enviar notificação de teste'))

  await act(async () => { button.click(); await Promise.resolve() })

  expect(toast).toHaveBeenCalledWith('push unavailable')
  expect(container.textContent).toContain('Notificações push')
})
