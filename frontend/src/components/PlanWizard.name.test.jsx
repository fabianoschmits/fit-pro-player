// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import PlanWizard from './PlanWizard.jsx'

const auth = vi.hoisted(() => ({ user: null }))
vi.mock('../auth/AuthProvider.jsx', () => ({ useAuth: () => auth }))
let root, container
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  auth.user = { displayName: 'joÃO da SILVA' }
  useStore.getState().update(s => { s.profile.name = '' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
it('prefills the first-access name from the account', async () => {
  await act(async () => root.render(<PlanWizard />))
  expect(container.querySelector('#wizard-name').value).toBe('João da Silva')
})
it('preserves an existing profile name', async () => {
  useStore.getState().update(s => { s.profile.name = 'Ana Souza' })
  await act(async () => root.render(<PlanWizard />))
  expect(container.querySelector('#wizard-name').value).toBe('Ana Souza')
})
