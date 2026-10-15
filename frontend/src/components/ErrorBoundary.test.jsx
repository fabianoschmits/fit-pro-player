// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary.jsx'

let root, container
function BrokenPage() { throw new Error('Fixture page failed') }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.spyOn(console, 'error').mockImplementation(() => {})
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks() })

it('recovers from a failed workspace page when its route changes', async () => {
  await act(async () => root.render(<ErrorBoundary resetKey="/professional/programs"><BrokenPage /></ErrorBoundary>))
  expect(container.querySelector('h1')).toBeNull()
  await act(async () => root.render(<ErrorBoundary resetKey="/professional"><h1>Área profissional</h1></ErrorBoundary>))
  expect(container.querySelector('h1')?.textContent).toBe('Área profissional')
})

it('preserves healthy page state when the workspace route changes', async () => {
  const render = resetKey => act(async () => root.render(<ErrorBoundary resetKey={resetKey}><input defaultValue="Rascunho" /></ErrorBoundary>))
  await render('/professional/profile')
  container.querySelector('input').value = 'Rascunho editado'
  await render('/professional/profile?section=registration')
  expect(container.querySelector('input').value).toBe('Rascunho editado')
})
